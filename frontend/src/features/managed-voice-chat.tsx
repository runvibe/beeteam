import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { RealtimeVoice, type VoiceTranscript } from "./realtime-voice";
type S = components["schemas"];
type Props = {
  api: ManagedAgentApi;
  contextMessages: S["Message"][];
  agentId: string;
  teamId?: string;
  conversation: string;
  accessMode: S["AccessMode"];
  disabled: boolean;
  readOnly: boolean;
  onSend: (body: S["SendAgentRequest"]) => Promise<S["AgentRequest"]>;
  onQueued: (request: S["AgentRequest"]) => void;
};

export function ManagedVoiceChat(props: Props) {
  useLocale();
  const latest = useRef(props);
  latest.current = props;
  const connection = useRef<RealtimeVoice | null>(null);
  const targetConversation = useRef(props.conversation);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<VoiceTranscript[]>([]);

  function stop() {
    connection.current?.close();
    connection.current = null;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setState("idle");
  }
  useEffect(() => () => stop(), []);
  useEffect(() => {
    stop();
  }, [props.agentId, props.teamId]);
  useEffect(() => {
    if (props.conversation !== targetConversation.current) stop();
    targetConversation.current = props.conversation;
  }, [props.conversation]);
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
    setTranscript([]);
    setState("connecting");
    targetConversation.current = latest.current.conversation;
    let submitting = false;
    let hydrated = false;
    let submissionUnknown = false;
    const voice = new RealtimeVoice(props.api.voice, {
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
      transcript: (entry) =>
        setTranscript((entries) => [...entries, entry].slice(-100)),
      execute: async (content) => {
        const context = latest.current;
        if (
          connection.current !== voice ||
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
          setError(t("managed.voiceUnknownSubmission"));
          return { state: "unknown", retrySubmission: false };
        } finally {
          submitting = false;
        }
      },
    });
    connection.current = voice;
    void voice.start();
  }

  return (
    <div className="managed-voice-chat">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state === "idle" && props.disabled}
        onClick={state === "idle" ? start : stop}
      >
        {state === "idle" ? <Mic /> : <PhoneOff />}
        {t(state === "idle" ? "managed.voiceStart" : "managed.voiceStop")}
      </Button>
      {state !== "idle" && (
        <span role="status">
          {t(
            state === "connecting"
              ? "managed.voiceConnecting"
              : "managed.voiceLive",
          )}
        </span>
      )}
      {error && <p role="alert">{error}</p>}
      {transcript.length > 0 && (
        <details>
          <summary>{t("managed.voiceTranscript")}</summary>
          <p>{t("managed.voiceTranscriptSession")}</p>
          {transcript.map((entry, index) => (
            <p key={index}>
              <strong>
                {t(
                  entry.role === "user"
                    ? "managed.voiceYou"
                    : "managed.voiceAssistant",
                )}
              </strong>{" "}
              {entry.text}
            </p>
          ))}
        </details>
      )}
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
