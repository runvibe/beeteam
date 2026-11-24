import { useMemo, type FormEvent, type ReactNode } from "react";
import {
  ArrowUp,
  Mic,
  X,
  Download,
  ExternalLink,
  KanbanSquare,
  ShieldQuestion,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BeeTeamLogo } from "@/components/bee-team-logo";
import { Markdown } from "@/components/markdown";
import { PlainTextEditor } from "@/components/plain-text-editor";
import type { components } from "@/api/generated/managed-agents";
import {
  managedMessageFileUrl,
  managedMessageImageUrl,
} from "@/api/managed-agents";
import { runtimeConfig } from "@/runtime";
import {
  attachmentCategory,
  formatAttachmentSize,
} from "./attachment-presentation";
import { categories } from "./attachment-categories";
import { MessageReasoning } from "./managed-agent-reasoning";

import type { ManagedVoiceControl } from "./managed-voice-chat";

type Message = components["schemas"]["Message"];

const WORKING = ["accepted", "queued", "preparing", "running"];
export const isWorking = (state?: string) => !!state && WORKING.includes(state);

/** Standard Bee Team logo; it pulses while the agent is working. */
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
      <BeeTeamLogo />
    </span>
  );
}

function MessageImages({ message }: { message: Message }) {
  if (!message.images?.length) return null;
  return (
    <div className="assistant-msg-images">
      {message.images.map((image) => {
        const src = managedMessageImageUrl(
          runtimeConfig.apiBaseUrl,
          message.conversationId,
          message.id,
          image.id,
        );
        return (
          <a key={image.id} href={src} target="_blank" rel="noreferrer">
            <img
              src={src}
              alt={image.description ?? t("managed.generatedImage")}
              loading="lazy"
            />
          </a>
        );
      })}
    </div>
  );
}

function GeneratedFile({
  message,
  file,
  onRecover,
  busy,
}: {
  message: Message;
  file: components["schemas"]["MessageFile"];
  onRecover?: () => void;
  busy?: boolean;
}) {
  const url =
    file.status === "available" && file.id && file.mediaType
      ? managedMessageFileUrl(
          runtimeConfig.apiBaseUrl,
          message.conversationId,
          message.id,
          file.id,
        )
      : undefined;
  const category =
    categories[attachmentCategory(file.mediaType ?? "", file.name)];
  const Icon = category.icon;
  return (
    <span
      className="assistant-generated-file"
      role="group"
      aria-label={file.name}
    >
      <span className="assistant-generated-file-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="assistant-generated-file-info">
        <strong title={file.name}>{file.name}</strong>
        <small>
          {url
            ? `${category.label}${file.sizeBytes !== undefined ? ` · ${formatAttachmentSize(file.sizeBytes)}` : ""}`
            : t("managed.fileUnavailable")}
        </small>
      </span>
      <span className="assistant-generated-file-actions">
        {url && file.mediaType === "application/pdf" && (
          <a
            href={`${url}/preview`}
            target="_blank"
            rel="noreferrer"
            aria-label={t("managed.previewFile", { name: file.name })}
            title={t("managed.previewFile", { name: file.name })}
          >
            <ExternalLink aria-hidden="true" />
          </a>
        )}
        {url && (
          <a
            href={url}
            download={file.name}
            aria-label={t("managed.downloadFile", { name: file.name })}
            title={t("managed.downloadFile", { name: file.name })}
          >
            <Download aria-hidden="true" />
          </a>
        )}
        {!url && onRecover && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecover}
            aria-label={t("managed.recoverFile", { name: file.name })}
            title={t("managed.recoverFile", { name: file.name })}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        )}
      </span>
    </span>
  );
}

function AgentMessage({
  message,
  onRecover,
  busy,
  active,
}: {
  message: Message;
  onRecover?: () => void;
  busy?: boolean;
  active?: boolean;
}) {
  const cards = useMemo(
    () =>
      new Map(
        (message.files ?? []).map((file) => [
          file.index,
          <GeneratedFile
            key={file.index}
            message={message}
            file={file}
            onRecover={onRecover}
            busy={busy}
          />,
        ]),
      ),
    [message, onRecover, busy],
  );
  return (
    <article
      className="assistant-msg assistant-msg-agent"
      aria-label={t("managed.agent")}
    >
      <div className="assistant-msg-body">
        {message.reasoning ? (
          <MessageReasoning text={message.reasoning} active={!!active} />
        ) : null}
        {message.content ? (
          <Markdown copyTables fileCitations={cards.size ? cards : undefined}>
            {message.content}
          </Markdown>
        ) : null}
        <MessageImages message={message} />
      </div>
    </article>
  );
}

export function ChatMessage({
  message,
  onRecover,
  busy,
  active,
}: {
  message: Message;
  onRecover?: () => void;
  busy?: boolean;
  active?: boolean;
}) {
  const label = t(`managed.${message.role}`);
  if (message.role === "requester")
    return (
      <article className="assistant-msg assistant-msg-user" aria-label={label}>
        <div className="assistant-bubble">
          <Markdown copyTables>{message.content}</Markdown>
        </div>
      </article>
    );
  if (message.role === "system")
    return (
      <article
        className="assistant-msg assistant-msg-system"
        aria-label={label}
      >
        <Markdown copyTables>{message.content}</Markdown>
      </article>
    );
  return <AgentMessage message={message} onRecover={onRecover} busy={busy} active={active} />;
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
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => onDecide("accept")}
        >
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
      <BeeTeamLogo variant="thin" className="assistant-welcome-watermark" aria-hidden="true" />
      <h3>{t("managed.welcomeTitle")}</h3>
      <p>{t(starters ? "managed.welcomeHq" : "managed.welcomeHint")}</p>
      {starters && (
        <ul className="assistant-starters">
          {STARTERS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <button type="button" onClick={() => onPick(t(`${id}Prompt`))}>
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
  accessControl,
  voice,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  locked: boolean;
  canSend: boolean;
  retry: boolean;
  readOnly?: boolean;
  accessControl?: ReactNode;
  voice?: ManagedVoiceControl;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSend) onSubmit();
  };
  const stopVoice = !!voice?.active && (!value.trim() || locked);
  const startVoice = !!voice && !voice.active && !value.trim() && !retry;
  const voiceAction = stopVoice || startVoice;
  const label = t(stopVoice ? "managed.voiceStop" : startVoice ? "managed.voiceStart" : retry ? "managed.retry" : "managed.send");
  return (
    <form className="assistant-composer" onSubmit={submit}>
      {readOnly && (
        <p className="assistant-readonly">{t("managed.readonly")}</p>
      )}
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
          {accessControl}
          {retry && !voiceAction ? (
            <Button type="submit" size="sm" disabled={!canSend}>
              {label}
            </Button>
          ) : (
            <Button
              type={voiceAction ? "button" : "submit"}
              size="icon"
              className="assistant-send"
              data-voice-action={voiceAction || undefined}
              disabled={stopVoice ? false : startVoice ? !voice?.canStart || locked || !!readOnly : !canSend}
              onClick={stopVoice ? voice?.stop : startVoice ? voice?.start : undefined}
              aria-label={label}
              title={label}
            >
              {stopVoice ? <X /> : startVoice ? <Mic /> : <ArrowUp />}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
