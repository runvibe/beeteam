import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from "react";
import { t, useLocale } from "@/i18n";
import { useVoicePreference } from "@/state/voice-preference";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { RealtimeVoice } from "./realtime-voice";
import "./voice-hexagon.css";
type S = components["schemas"];
export type ManagedVoiceControl = {
  active: boolean;
  starting?: boolean;
  canStart: boolean;
  start: () => void;
  stop: () => void;
  adoptConversation?: (id: string) => void;
};
type Props = {
  controlRef?: Ref<ManagedVoiceControl>;
  children: (control: ManagedVoiceControl) => ReactNode;
  api: ManagedAgentApi;
  contextMessages: S["Message"][];
  agentId: string;
  teamId?: string;
  conversation: string;
  selectionToken?: string | null;
  accessMode: S["AccessMode"];
  disabled: boolean;
  readOnly: boolean;
  onSend: (body: S["SendAgentRequest"]) => Promise<S["AgentRequest"]>;
  onQueued: (request: S["AgentRequest"]) => void;
  onAssociated: (conversationId: string) => void;
  onTranscript: (conversationId: string) => void;
  onActivate?: () => void;
};

export function ManagedVoiceChat(props: Props) {
  useLocale();
  const latest = useRef(props);
  latest.current = props;
  const connection = useRef<RealtimeVoice | null>(null);
  const lastCall = useRef<RealtimeVoice | null>(null);
  const mounted = useRef(true);
  const voiceVisual = useRef<HTMLDivElement>(null);
  const targetConversation = useRef(props.conversation);
  const selectedToken = useRef(props.selectionToken);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [error, setError] = useState("");
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const [outputMuted, setOutputMuted] = useState(false);

  function stop() {
    connection.current?.close();
    connection.current = null;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setState("idle");
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  useEffect(() => {
    stop();
  }, [props.agentId, props.teamId]);
  useEffect(() => {
    if (props.conversation !== targetConversation.current) stop();
    targetConversation.current = props.conversation;
  }, [props.conversation]);
  useEffect(() => {
    if (
      props.selectionToken !== selectedToken.current &&
      props.selectionToken !== targetConversation.current
    ) {
      stop();
      setError("");
      lastCall.current = null;
    }
    selectedToken.current = props.selectionToken;
  }, [props.selectionToken]);
  useEffect(() => {
    if (props.readOnly) stop();
  }, [props.readOnly]);

  function monitor(voice: RealtimeVoice, requestId: string) {
    let lastState = "";
    async function check() {
      if (connection.current !== voice) return;
      try {
        const snapshot = await props.api.snapshot(requestId);
        if (connection.current !== voice) return;
        const { state } = snapshot.request;
        const terminal = [
          "completed",
          "failed",
          "cancelled",
          "uncertain",
        ].includes(state);
        if (
          (terminal || state === "awaiting_approval") &&
          lastState !== state
        ) {
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
        }
        lastState = state;
        if (terminal) return;
      } catch {
        if (connection.current !== voice) return;
        if (lastState !== "connection_error")
          void voice.report({
            requestId,
            state: "connection_error",
            retrySubmission: false,
          });
        lastState = "connection_error";
      }
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        void check();
      }, 2000);
      timers.current.add(timer);
    }
    void check();
  }

  function start() {
    if (connection.current || latest.current.disabled) return;
    setError("");
    setMicrophoneMuted(false);
    setOutputMuted(false);
    setState("connecting");
    latest.current.onActivate?.();
    targetConversation.current = latest.current.conversation;
    const original = {
      agentId: props.agentId,
      teamId: props.teamId,
      conversation: props.conversation,
      selectionToken: props.selectionToken,
    };
    let associated = false;
    let associatedConversation = "";
    let submitting = false;
    let hydrated = false;
    let submissionUnknown = false;
    const voice = new RealtimeVoice(props.api.voice, {
      associated: (id) => {
        const context = latest.current;
        if (
          connection.current !== voice ||
          context.agentId !== original.agentId ||
          context.teamId !== original.teamId ||
          context.conversation !== original.conversation ||
          context.selectionToken !== original.selectionToken ||
          context.readOnly
        )
          return false;
        associated = true;
        associatedConversation = id;
        targetConversation.current = id;
        context.onAssociated(id);
        return true;
      },
      stopped: (failure) => {
        if (!mounted.current) return;
        if (associatedConversation)
          latest.current.onTranscript(associatedConversation);
        if (
          failure &&
          lastCall.current === voice &&
          latest.current.conversation === associatedConversation
        )
          setError(failure.message);
      },
      outputLevel: (level) => {
        if (connection.current === voice)
          voiceVisual.current?.style.setProperty(
            "--voice-level",
            level.toFixed(3),
          );
      },
      connected: () => {
        if (connection.current !== voice) return;
        setState("live");
        if (!hydrated) {
          hydrated = true;
          void voice.hydrate(voiceHistory(latest.current.contextMessages));
        }
      },
      failed: (failure) => {
        if (connection.current === voice) {
          stop();
          setError(failure.message);
        }
      },
      transcript: () => {
        if (connection.current === voice && associated)
          latest.current.onTranscript(targetConversation.current);
      },
      execute: async (content) => {
        const context = latest.current;
        if (
          connection.current !== voice ||
          !associated ||
          context.disabled ||
          context.readOnly ||
          submitting ||
          submissionUnknown
        )
          return { state: "not_submitted", reason: "chat_unavailable" };
        submitting = true;
        const body: S["SendAgentRequest"] = {
          content,
          ...(context.teamId ? { accessMode: context.accessMode } : {}),
          ...(targetConversation.current
            ? { conversationId: targetConversation.current }
            : context.teamId
              ? { teamId: context.teamId }
              : {}),
        };
        try {
          const request = await context.onSend(body);
          if (connection.current === voice) {
            targetConversation.current = request.conversationId;
            context.onQueued(request);
            monitor(voice, request.id);
          }
          return {
            state: request.state,
            requestId: request.id,
            accepted: true,
          };
        } catch {
          submissionUnknown = true;
          if (connection.current === voice)
            setError(t("managed.voiceUnknownSubmission"));
          return { state: "unknown", retrySubmission: false };
        } finally {
          submitting = false;
        }
      },
    });
    connection.current = voice;
    lastCall.current = voice;
    const selectedVoice = useVoicePreference.getState().voiceId;
    void voice.start({
      ...(selectedVoice ? { voice: selectedVoice } : {}),
      agentId: props.agentId,
      ...(props.teamId ? { teamId: props.teamId } : {}),
      ...(props.conversation ? { conversationId: props.conversation } : {}),
    });
  }

  const currentCall = connection.current;
  const control: ManagedVoiceControl = {
    active: state !== "idle",
    starting: state === "connecting",
    canStart: !props.disabled && !props.readOnly,
    start,
    stop,
    adoptConversation: (id) => {
      if (currentCall && connection.current === currentCall)
        targetConversation.current = id;
    },
  };
  useImperativeHandle(props.controlRef, () => control);
  return (
    <div className="managed-voice-chat" data-call-active={state !== "idle"}>
      {state !== "idle" && (
        <div className="voice-avatar-overlay">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="voice-mute-button voice-mute-microphone"
            aria-pressed={microphoneMuted}
            aria-label={t(
              microphoneMuted
                ? "managed.voiceUnmuteMicrophone"
                : "managed.voiceMuteMicrophone",
            )}
            title={t(
              microphoneMuted
                ? "managed.voiceUnmuteMicrophone"
                : "managed.voiceMuteMicrophone",
            )}
            onClick={() => {
              const muted = !microphoneMuted;
              connection.current?.setMicrophoneMuted(muted);
              setMicrophoneMuted(muted);
            }}
          >
            {microphoneMuted ? <MicOff /> : <Mic />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="voice-mute-button voice-mute-output"
            aria-pressed={outputMuted}
            aria-label={t(
              outputMuted
                ? "managed.voiceUnmuteOutput"
                : "managed.voiceMuteOutput",
            )}
            title={t(
              outputMuted
                ? "managed.voiceUnmuteOutput"
                : "managed.voiceMuteOutput",
            )}
            onClick={() => {
              const muted = !outputMuted;
              connection.current?.setOutputMuted(muted);
              setOutputMuted(muted);
            }}
          >
            {outputMuted ? <VolumeX /> : <Volume2 />}
          </Button>
          <div
            className="voice-hexagon-stage"
            data-state={state}
            ref={voiceVisual}
            role="img"
            aria-label={t("managed.voiceVisual")}
          >
            <div className="voice-hexagon-outline voice-hexagon-echo" />
            <div className="voice-hexagon-outline" />
            <div className="voice-hexagon-bars">
              <span />
              <span />
              <span />
            </div>
          </div>
          <span className="sr-only" role="status">
            {t(
              state === "connecting"
                ? "managed.voiceConnecting"
                : "managed.voiceLive",
            )}
          </span>
        </div>
      )}
      {props.children(control)}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** Keep complete recent message objects within the native context byte budget. */
export function voiceHistory(messages: S["Message"][]) {
  const eligible = messages.filter(
    (message) => message.role === "requester" || message.role === "agent",
  );
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of [...eligible].reverse()) {
    const item = {
      role:
        message.role === "requester"
          ? ("user" as const)
          : ("assistant" as const),
      content: message.content,
    };
    const candidate = [item, ...history];
    if (new TextEncoder().encode(JSON.stringify(candidate)).length > 23000)
      break;
    history.unshift(item);
  }
  return { messages: history, truncated: history.length < eligible.length };
}
