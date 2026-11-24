import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { t } from "@/i18n";
import { useVoicePreference } from "@/state/voice-preference";
import { RealtimeVoice } from "./realtime-voice";
import { voiceHistory } from "./voice-history";
import { VoiceNotSubmitted } from "./voice-delivery-error";
type S = components["schemas"];
export type ManagedVoiceProps = {
  api: ManagedAgentApi;
  contextMessages: S["Message"][];
  agentId: string;
  teamId?: string;
  conversation: string;
  selectionToken?: string | null;
  label?: string;
  accessMode: S["AccessMode"];
  disabled: boolean;
  readOnly: boolean;
  onSend: (body: S["SendAgentRequest"]) => Promise<S["AgentRequest"]>;
  onQueued: (request: S["AgentRequest"]) => void;
  onAssociated: (conversationId: string) => void;
  onTranscript: (conversationId: string) => void;
  onActivate?: () => void;
  onReturn?: (conversationId: string) => void;
  onSelect?: (conversationId: string, requestId?: string) => void;
};
export type VoiceSnapshot = {
  state: "idle" | "connecting" | "live";
  origin: ManagedVoiceProps | null;
  conversation: string;
  microphoneMuted: boolean;
  outputMuted: boolean;
  error: string;
  inlineTarget: HTMLDivElement | null;
};

/** One owner per application. No view or mutable selection owns transport callbacks. */
export class VoiceSessionOwner {
  private current: RealtimeVoice | null = null;
  private last: RealtimeVoice | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private value: VoiceSnapshot = {
    state: "idle",
    origin: null,
    conversation: "",
    microphoneMuted: false,
    outputMuted: false,
    error: "",
    inlineTarget: null,
  };
  private view: ManagedVoiceProps | null = null;
  private anchor: HTMLDivElement | null = null;
  visual: HTMLDivElement | null = null;
  snapshot = () => this.value;
  dismissError = () => { if (!this.current) this.update({ error: "" }); };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<VoiceSnapshot>) {
    this.value = { ...this.value, ...patch };
    this.value.inlineTarget =
      this.view && this.matches(this.view) ? this.anchor : null;
    this.listeners.forEach((listener) => listener());
  }
  matches(props: ManagedVoiceProps) {
    const { origin, conversation } = this.value;
    if (
      !origin ||
      props.agentId !== origin.agentId ||
      props.teamId !== origin.teamId
    )
      return false;
    // The external token changes before the local conversation state catches up.
    if (
      props.selectionToken !== origin.selectionToken &&
      props.selectionToken !== conversation
    )
      return false;
    return (
      props.conversation === conversation ||
      (!props.conversation &&
        !origin.conversation &&
        props.selectionToken === origin.selectionToken)
    );
  }
  updateView(
    props: ManagedVoiceProps | null,
    anchor: HTMLDivElement | null = null,
  ) {
    this.view = props;
    this.anchor = anchor;
    const target = props && this.matches(props) ? anchor : null;
    if (target !== this.value.inlineTarget)
      this.update({ inlineTarget: target });
    if (props && this.matches(props) && props.readOnly && this.current)
      this.stop();
  }
  stop = () => {
    const previous = this.current;
    this.current = null;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.update({ state: "idle" });
    previous?.close();
  };
  dispose = () => {
    this.stop();
    this.last = null;
    this.view = null;
  };
  adoptConversation(id: string) {
    if (this.current) this.update({ conversation: id });
  }
  muteMicrophone(muted: boolean) {
    this.current?.setMicrophoneMuted(muted);
    this.update({ microphoneMuted: muted });
  }
  muteOutput(muted: boolean) {
    this.current?.setOutputMuted(muted);
    this.update({ outputMuted: muted });
  }
  start(origin: ManagedVoiceProps) {
    if (origin.disabled || origin.readOnly) return;
    this.stop();
    this.update({
      origin: { ...origin },
      conversation: origin.conversation,
      state: "connecting",
      error: "",
      microphoneMuted: false,
      outputMuted: false,
    });
    origin.onActivate?.();
    let associated = false,
      associatedConversation = "",
      submitting = false,
      hydrated = false,
      submissionUnknown = false;
    const voice = new RealtimeVoice(origin.api.voice, {
      associated: (id) => {
        if (this.current !== voice) return false;
        associated = true;
        associatedConversation = id;
        this.update({ conversation: id });
        origin.onAssociated(id);
        if (this.view && this.matches(this.view)) this.view.onSelect?.(id);
        return true;
      },
      stopped: (failure) => {
        // Even a replaced call may finish saving its own transcript.
        if (associatedConversation) origin.onTranscript(associatedConversation);
        if (this.last === voice && failure)
          this.update({ error: failure.message });
      },
      outputLevel: (level) => {
        if (this.current === voice)
          this.visual?.style.setProperty("--voice-level", level.toFixed(3));
      },
      connected: () => {
        if (this.current !== voice) return;
        this.update({ state: "live" });
        if (!hydrated) {
          hydrated = true;
          const messages =
            this.view && this.matches(this.view)
              ? this.view.contextMessages
              : origin.contextMessages;
          void voice.hydrate(voiceHistory(messages));
        }
      },
      failed: (failure) => {
        if (this.current === voice) {
          this.stop();
          this.update({ error: failure.message });
        }
      },
      transcript: () => {
        if (this.current === voice && associated)
          origin.onTranscript(associatedConversation);
      },
      execute: async (content) => {
        const unavailable =
          this.view &&
          this.matches(this.view) &&
          (this.view.disabled || this.view.readOnly);
        if (
          this.current !== voice ||
          !associated ||
          unavailable ||
          submitting ||
          submissionUnknown
        )
          return { state: "not_submitted", reason: "chat_unavailable" };
        submitting = true;
        try {
          const request = await origin.onSend({
            content,
            ...(origin.teamId ? { accessMode: origin.accessMode } : {}),
            conversationId: this.value.conversation,
          });
          if (this.current === voice) {
            origin.onQueued(request);
            if (this.view && this.matches(this.view))
              this.view.onSelect?.(request.conversationId, request.id);
            this.monitor(voice, origin.api, request.id);
          }
          return {
            state: request.state,
            requestId: request.id,
            accepted: true,
          };
        } catch (error) {
          if (error instanceof VoiceNotSubmitted)
            return { state: "not_submitted", reason: "chat_unavailable" };
          submissionUnknown = true;
          if (this.current === voice)
            this.update({ error: t("managed.voiceUnknownSubmission") });
          return { state: "unknown", retrySubmission: false };
        } finally {
          submitting = false;
        }
      },
    });
    this.current = voice;
    this.last = voice;
    const selectedVoice = useVoicePreference.getState().voiceId;
    void voice.start({
      ...(selectedVoice ? { voice: selectedVoice } : {}),
      agentId: origin.agentId,
      ...(origin.teamId ? { teamId: origin.teamId } : {}),
      ...(origin.conversation ? { conversationId: origin.conversation } : {}),
    });
  }
  private monitor(
    voice: RealtimeVoice,
    api: ManagedAgentApi,
    requestId: string,
  ) {
    let lastState = "";
    const check = async () => {
      if (this.current !== voice) return;
      try {
        const snapshot = await api.snapshot(requestId);
        if (this.current !== voice) return;
        const { state } = snapshot.request;
        const terminal = [
          "completed",
          "failed",
          "cancelled",
          "uncertain",
        ].includes(state);
        if ((terminal || state === "awaiting_approval") && lastState !== state)
          void voice.report({
            requestId,
            state,
            ...(state === "completed"
              ? {
                  result: Array.from(
                    snapshot.messages.items
                      .filter(
                        (m) => m.requestId === requestId && m.role === "agent",
                      )
                      .map((m) => m.content)
                      .join("\n"),
                  )
                    .slice(-5000)
                    .join(""),
                }
              : {}),
            ...(snapshot.request.error
              ? { error: snapshot.request.error.message }
              : {}),
          });
        lastState = state;
        if (terminal) return;
      } catch {
        if (this.current !== voice) return;
        if (lastState !== "connection_error")
          void voice.report({
            requestId,
            state: "connection_error",
            retrySubmission: false,
          });
        lastState = "connection_error";
      }
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void check();
      }, 2000);
      this.timers.add(timer);
    };
    void check();
  }
}
