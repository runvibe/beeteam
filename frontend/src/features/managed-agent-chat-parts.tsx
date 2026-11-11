import { type FormEvent, type ReactNode } from "react";
import {
  ArrowUp,
  Boxes,
  KanbanSquare,
  ShieldQuestion,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { PlainTextEditor } from "@/components/plain-text-editor";
import type { components } from "@/api/generated/managed-agents";

type Message = components["schemas"]["Message"];

const WORKING = ["accepted", "queued", "preparing", "running"];
export const isWorking = (state?: string) => !!state && WORKING.includes(state);

/** Hexagonal agent mark; it pulses while the agent is working. */
export function AgentMark({
  working = false,
  size = "sm",
}: {
  working?: boolean;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className="agent-mark"
      data-size={size}
      data-working={working || undefined}
      aria-hidden="true"
    >
      <Sparkles />
    </span>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const label = t(`managed.${message.role}`);
  if (message.role === "requester")
    return (
      <article className="assistant-msg assistant-msg-user" aria-label={label}>
        <div className="assistant-bubble">
          <Markdown>{message.content}</Markdown>
        </div>
      </article>
    );
  if (message.role === "system")
    return (
      <article className="assistant-msg assistant-msg-system" aria-label={label}>
        <Markdown>{message.content}</Markdown>
      </article>
    );
  return (
    <article className="assistant-msg assistant-msg-agent" aria-label={label}>
      <AgentMark />
      <div className="assistant-msg-body">
        <Markdown>{message.content}</Markdown>
      </div>
    </article>
  );
}

export function RequestStatus({
  state,
  error,
  action,
}: {
  state: string;
  error?: string;
  action?: ReactNode;
}) {
  const working = isWorking(state);
  const tone =
    state === "failed" || state === "uncertain"
      ? "danger"
      : state === "cancelled"
        ? "muted"
        : "default";
  return (
    <div className="assistant-status" role="status" data-tone={tone}>
      <AgentMark working={working} />
      <div className="assistant-status-text">
        <span>
          {t(`managed.${state}`)}
          {working && (
            <span className="assistant-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
        {error && <p>{error}</p>}
      </div>
      {action}
    </div>
  );
}

export function ApprovalCard({
  description,
  disabled,
  onDecide,
}: {
  description: string;
  disabled: boolean;
  onDecide: (decision: "accept" | "decline") => void;
}) {
  return (
    <div className="assistant-approval" role="group">
      <header>
        <ShieldQuestion aria-hidden="true" />
        <strong>{t("managed.awaiting_approval")}</strong>
      </header>
      <p>{description}</p>
      <div className="assistant-approval-actions">
        <Button size="sm" disabled={disabled} onClick={() => onDecide("accept")}>
          {t("managed.accept")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onDecide("decline")}
        >
          {t("managed.decline")}
        </Button>
      </div>
    </div>
  );
}

const STARTERS = [
  { id: "managed.starterTeam", icon: Users },
  { id: "managed.starterAgent", icon: UserPlus },
  { id: "managed.starterBoard", icon: KanbanSquare },
  { id: "managed.starterTour", icon: Boxes },
] as const;

export function ChatWelcome({
  starters,
  onPick,
}: {
  starters: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="assistant-welcome">
      <AgentMark size="lg" />
      <h3>{t("managed.welcomeTitle")}</h3>
      <p>{t(starters ? "managed.welcomeHq" : "managed.welcomeHint")}</p>
      {starters && (
        <ul className="assistant-starters">
          {STARTERS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(t(`${id}Prompt`))}
              >
                <Icon aria-hidden="true" />
                <span>{t(id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  locked,
  canSend,
  retry,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  locked: boolean;
  canSend: boolean;
  retry: boolean;
  readOnly?: boolean;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSend) onSubmit();
  };
  const label = t(retry ? "managed.retry" : "managed.send");
  return (
    <form className="assistant-composer" onSubmit={submit}>
      {readOnly && <p className="assistant-readonly">{t("managed.readonly")}</p>}
      <div className="assistant-composer-box">
        <PlainTextEditor
          aria-label={t("managed.message")}
          placeholder={t("managed.placeholder")}
          value={value}
          disabled={locked || readOnly}
          onChange={onChange}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
        />
        <div className="assistant-composer-row">
          <small>{t("managed.composerHint")}</small>
          {retry ? (
            <Button type="submit" size="sm" disabled={!canSend}>
              {label}
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="assistant-send"
              disabled={!canSend}
              aria-label={label}
              title={label}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
