import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Send,
  Square,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLocale, t as tr } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/components/shared";
import { AgentName } from "@/components/names";
import { useEntity } from "@/api/context";
import { useUi } from "@/state/ui";
import { ApiError } from "@/api/types";
import type { LeaderChatApi } from "@/api/leader-chat";
import type {
  AgentRuntime,
  CreateIntegratedSession,
} from "@/api/leader-chat-types";
import { useLeaderChat } from "./use-leader-chat";
import { turnBlocksSending } from "./leader-chat-state";
import "./leader-chat.css";

export function ChatError({ error }: { error: unknown }) {
  const codes = [
    "turn_in_progress",
    "session_busy",
    "binding_chat_conflict",
    "local_action_forbidden",
    "session_creation_uncertain",
    "provider_unavailable",
    "needs_auth",
    "invalid_tool_profile",
    "version_conflict",
    "external_mode",
    "session_not_ready",
    "session_binding_conflict",
    "approval_expired",
    "not_found",
    "unsupported_capability",
    "invalid_request",
    "payload_too_large",
  ];
  return (
    <div role="alert" className="leader-chat-error">
      <p>
        {error instanceof ApiError && codes.includes(error.code)
          ? tr(`chat.${error.code}`)
          : tr("chat.error")}
      </p>
      {error instanceof Error && (
        <details>
          <summary>{tr("chat.errorDetails")}</summary>
          <p>{error.message}</p>
        </details>
      )}
    </div>
  );
}
type LeaderChatProps = {
  api?: LeaderChatApi;
  teamId: string;
  leaderAgentId: string;
  leaderVersion?: number;
  onSessionCreated?: () => void;
};
export function LeaderChat(props: LeaderChatProps) {
  return (
    <LeaderChatBody key={`${props.teamId}:${props.leaderAgentId}`} {...props} />
  );
}
function LeaderChatBody({
  api,
  teamId,
  leaderAgentId,
  leaderVersion,
  onSessionCreated,
}: LeaderChatProps) {
  useLocale();
  const chat = useLeaderChat(api, teamId, leaderAgentId);
  const [draft, setDraft] = useState(""),
    [replace, setReplace] = useState(false),
    [setupBusy, setSetupBusy] = useState(false),
    [setupError, setSetupError] = useState<unknown>(null);
  const [webSearch, setWebSearch] = useState<"live" | "cached" | "disabled">(
      "live",
    ),
    [network, setNetwork] = useState(true),
    [mcpNames, setMcpNames] = useState(""),
    [skillRoots, setSkillRoots] = useState("");
  const setupRequest = useRef<{
    key: string;
    body: CreateIntegratedSession;
    version: number;
  } | null>(null);
  const list = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    atBottom = useRef(true);
  const snap = chat.snapshot,
    runtime = chat.runtime,
    turn = snap?.activeTurn;
  const readOnly = !!snap && snap.chat.bindingId !== runtime?.bindingId;
  const blocked = turnBlocksSending(turn?.status);
  const bytes = new TextEncoder().encode(draft).length;
  const canSend =
    !chat.working &&
    !readOnly &&
    (chat.sendUncertain ||
      (!!draft.trim() &&
        bytes <= 65536 &&
        !blocked &&
        runtime?.readiness === "ready"));
  useEffect(() => {
    if (atBottom.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [snap?.messages, snap?.pendingApprovals]);
  useEffect(() => {
    setDraft("");
    atBottom.current = true;
  }, [chat.chatId]);
  useEffect(() => {
    if (chat.resolvedSend) setDraft("");
  }, [chat.resolvedSend]);
  if (!api) return <p className="muted-copy">{tr("chat.unavailable")}</p>;
  async function send() {
    if (await chat.send(draft)) {
      setDraft("");
      composer.current?.focus();
    }
  }
  function handleComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSend) void send();
    }
  }
  async function setup() {
    if (!api || leaderVersion === undefined || setupBusy) return;
    setSetupBusy(true);
    setSetupError(null);
    const lines = (value: string) => [
      ...new Set(
        value
          .split(/\r?\n/)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    setupRequest.current ??= {
      key: crypto.randomUUID(),
      body: {
        expectedBindingId: runtime?.bindingId ?? null,
        toolProfile: {
          webSearch,
          networkAccess: network,
          enabledMcpServers: lines(mcpNames),
          skillRoots: lines(skillRoots),
        },
      },
      version: leaderVersion,
    };
    const request = setupRequest.current;
    try {
      await api.createSession(
        leaderAgentId,
        request.body,
        request.version,
        request.key,
      );
      setupRequest.current = null;
      setReplace(false);
      onSessionCreated?.();
      chat.refresh();
    } catch (e) {
      setSetupError(e);
      if (e instanceof ApiError && e.status > 0 && e.status < 500 && e.code !== "session_creation_uncertain" && e.code !== "invalid_response")
        setupRequest.current = null;
    } finally {
      setSetupBusy(false);
    }
  }
  return (
    <section className="leader-chat" aria-label={tr("chat.title")}>
      <header className="leader-chat-toolbar">
        <h2>
          <MessageSquare size={18} />
          {tr("chat.title")}
        </h2>
        <Button
          variant="ghost"
          onClick={() => {
            onSessionCreated?.();
            chat.refresh();
          }}
          disabled={chat.working || setupBusy}
          aria-label={tr("chat.refresh")}
        >
          <RefreshCw size={16} />
        </Button>
      </header>
      {chat.loading && <p role="status">{tr("chat.loading")}</p>}
      {chat.error != null && <ChatError error={chat.error} />}
      {runtime && (
        <>
          <p className="small-note">
            {runtime.harness} ·{" "}
            {runtime.mode === "external"
              ? tr("chat.external_mode")
              : tr(
                  `chat.${runtime.readiness === "unavailable" ? "runtime_unavailable" : runtime.readiness}`,
                )}
          </p>
          {runtime.mode === "external" && <p>{tr("chat.external")}</p>}
          <RuntimeTools runtime={runtime} />
          {(runtime.mode === "external" || !runtime.bindingId) && (
            <form
              className="leader-chat-setup"
              onSubmit={(e) => {
                e.preventDefault();
                void setup();
              }}
            >
              <p className="small-note">{tr("chat.setupHint")}</p>
              <details>
                <summary>{tr("chat.tools")}</summary>
                <fieldset
                  disabled={setupBusy || !!setupRequest.current}
                  className="leader-chat-setup"
                >
                  <label htmlFor="leader-web">{tr("chat.web")}</label>
                  <select
                    id="leader-web"
                    value={webSearch}
                    onChange={(e) =>
                      setWebSearch(e.target.value as typeof webSearch)
                    }
                  >
                    <option value="live">{tr("chat.webLive")}</option>
                    <option value="cached">{tr("chat.webCached")}</option>
                    <option value="disabled">{tr("chat.disabled")}</option>
                  </select>
                  <label className="leader-chat-replace">
                    <input
                      type="checkbox"
                      checked={network}
                      onChange={(e) => setNetwork(e.target.checked)}
                    />
                    {tr("chat.network")}
                  </label>
                  <label htmlFor="leader-mcp">{tr("chat.mcpNames")}</label>
                  <Textarea
                    id="leader-mcp"
                    value={mcpNames}
                    onChange={(e) => setMcpNames(e.target.value)}
                  />
                  <p className="small-note">{tr("chat.mcpHint")}</p>
                  <label htmlFor="leader-skills">{tr("chat.skillRoots")}</label>
                  <Textarea
                    id="leader-skills"
                    value={skillRoots}
                    onChange={(e) => setSkillRoots(e.target.value)}
                  />
                  <p className="small-note">{tr("chat.skillsHint")}</p>
                </fieldset>
              </details>
              {runtime.bindingId && (
                <label className="leader-chat-replace">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                    disabled={setupBusy}
                  />
                  {tr("chat.replace")}
                </label>
              )}
              <Button
                type="submit"
                disabled={
                  setupBusy ||
                  leaderVersion === undefined ||
                  (!!runtime.bindingId && !replace)
                }
              >
                {setupRequest.current && !setupBusy ? tr("chat.checkSetup") : tr("chat.setup")}
              </Button>
              {setupRequest.current && !setupBusy && <p role="status">{tr("chat.setupUncertain")}</p>}
              {setupError != null && <ChatError error={setupError} />}
            </form>
          )}
          {runtime.mode === "integrated" &&
            runtime.bindingId &&
            runtime.readiness === "ready" &&
            (!snap || readOnly) && (
              <Button onClick={() => void chat.start()} disabled={chat.working}>
                {tr("chat.start")}
              </Button>
            )}
        </>
      )}
      {chat.chats.length > 0 && (
        <label className="leader-chat-history">
          {tr("chat.history")}
          <select
            value={chat.chatId ?? ""}
            onChange={(e) => chat.setChatId(e.target.value)}
            disabled={chat.working || chat.sendUncertain}
          >
            {chat.chats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {formatDate(c.createdAt)}
              </option>
            ))}
          </select>
          {chat.nextChats && (
            <Button
              variant="ghost"
              onClick={() => void chat.moreChats()}
              disabled={chat.working}
            >
              {tr("chat.moreChats")}
            </Button>
          )}
        </label>
      )}
      {snap && (
        <>
          <p role="status" className="small-note">
            {tr(`chat.${chat.connection}`)}
          </p>
          <div
            className="leader-chat-messages"
            ref={list}
            onScroll={() => {
              if (list.current)
                atBottom.current =
                  list.current.scrollHeight -
                    list.current.scrollTop -
                    list.current.clientHeight <
                  80;
            }}
            aria-label={tr("chat.history")}
          >
            {snap.olderMessagesCursor && (
              <Button
                variant="ghost"
                disabled={chat.working}
                onClick={async () => {
                  const el = list.current,
                    oldHeight = el?.scrollHeight ?? 0;
                  atBottom.current = false;
                  await chat.older();
                  requestAnimationFrame(() => {
                    if (el) el.scrollTop += el.scrollHeight - oldHeight;
                  });
                }}
              >
                {tr("chat.older")}
              </Button>
            )}
            {!snap.messages.length && (
              <p className="leader-chat-empty">{tr("chat.empty")}</p>
            )}
            {snap.messages.map((m) => (
              <article
                key={m.id}
                className={`leader-chat-message leader-chat-message-${m.role}`}
              >
                <header>
                  <strong>
                    {m.role === "user"
                      ? tr("chat.you")
                      : m.role === "assistant"
                        ? tr("chat.leader")
                        : tr("chat.notice")}
                  </strong>
                  <time dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
                </header>
                <Markdown>{m.content}</Markdown>
                {m.taskId && <ChatTaskLink id={m.taskId} />}
              </article>
            ))}
          </div>
          {snap.toolActivities.map((tool) => (
            <p className="small-note" key={tool.id}>
              {tool.name} · {tr(`chat.${tool.status}`)} — {tool.summary}
            </p>
          ))}
          {snap.pendingApprovals.map((approval) => (
            <section
              className="leader-chat-approval"
              key={approval.id}
              aria-label={tr("chat.approval")}
            >
              <h3>
                <ShieldCheck size={18} />
                {approval.title}
              </h3>
              <p>{approval.description}</p>
              <p className="small-note">
                {tr("chat.agent")}: <AgentName id={approval.agentId} />
              </p>
              {approval.taskId && <ChatTaskLink id={approval.taskId} />}
              {approval.command && <pre>{approval.command}</pre>}
              {approval.host && <p>{approval.host}</p>}
              {approval.paths.map((path) => (
                <p key={path}>{path}</p>
              ))}
              <div className="leader-chat-actions">
                <Button
                  disabled={chat.working}
                  onClick={() => void chat.decide(approval, "accept")}
                >
                  {tr("chat.accept")}
                </Button>
                <Button
                  variant="outline"
                  disabled={chat.working}
                  onClick={() => void chat.decide(approval, "decline")}
                >
                  {tr("chat.decline")}
                </Button>
              </div>
            </section>
          ))}
          {turn && <p role="status">{tr(`chat.${turn.status}`)}</p>}
          {turn?.status === "uncertain" && !readOnly && <div>
            <Button disabled={chat.working} onClick={() => void chat.reconcile()}>{tr("chat.reconcile")}</Button>
            {chat.reconciliationUnresolved && <p role="status">{tr("chat.reconcilePending")}</p>}
          </div>}
          {turn?.failure && (
            <details>
              <summary>{tr("chat.errorDetails")}</summary>
              <p>{turn.failure.message}</p>
            </details>
          )}
          {readOnly ? (
            <p>{tr("chat.readOnly")}</p>
          ) : (
            <form
              className="leader-chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) void send();
              }}
            >
              <label htmlFor="leader-message">{tr("chat.message")}</label>
              <Textarea
                ref={composer}
                id="leader-message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={chat.working || chat.sendUncertain}
                rows={3}
                onKeyDown={handleComposerKey}
              />
              <p className="small-note">{tr("chat.keyboardSend")}</p>
              {bytes > 65536 && <p role="alert">{tr("chat.tooLong")}</p>}
              {chat.sendUncertain && (
                <p role="status">{tr("chat.uncertainSend")}</p>
              )}
              <div className="leader-chat-actions">
                <Button
                  type="submit"
                  aria-label={
                    chat.sendUncertain ? tr("chat.retry") : tr("chat.send")
                  }
                  disabled={!canSend}
                >
                  <Send size={16} />
                  {chat.sendUncertain ? tr("chat.retry") : tr("chat.send")}
                </Button>
                {turn &&
                  blocked &&
                  turn.status !== "uncertain" &&
                  runtime?.capabilities?.interrupt && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        chat.working || turn.status === "cancel_requested"
                      }
                      onClick={() => void chat.cancel()}
                    >
                      <Square size={14} />
                      {tr("chat.cancel")}
                    </Button>
                  )}
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
function RuntimeTools({ runtime }: { runtime: AgentRuntime }) {
  if (!runtime.tools) return null;
  return (
    <details className="leader-chat-tools">
      <summary>{tr("chat.tools")}</summary>
      <p>
        {tr("chat.web")}:{" "}
        {runtime.tools.webSearch === "disabled"
          ? tr("chat.disabled")
          : tr("chat.enabled")}
      </p>
      <p>
        {tr("chat.network")}:{" "}
        {runtime.tools.networkAccess ? tr("chat.enabled") : tr("chat.disabled")}
      </p>
      {runtime.tools.skills.map((s) => (
        <p key={s.id}>
          {s.name} ·{" "}
          {s.enabled && s.available ? tr("chat.enabled") : tr("chat.disabled")}
        </p>
      ))}
      {runtime.tools.mcpServers.map((s) => (
        <p key={s.id}>
          {s.name} ·{" "}
          {s.enabled && s.status === "connected"
            ? tr("chat.enabled")
            : tr("chat.disabled")}
        </p>
      ))}
    </details>
  );
}
function ChatTaskLink({ id }: { id: string }) {
  const task = useEntity("tasks", id),
    open = useUi((s) => s.openTask);
  return (
    <Button variant="link" onClick={() => open(id)}>
      {task.data?.title ?? tr("chat.task")}
    </Button>
  );
}
