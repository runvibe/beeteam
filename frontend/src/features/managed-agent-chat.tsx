import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Settings2, SquarePen } from "lucide-react";
import { Markdown } from "@/components/markdown";
import type { LeaderChatApi } from "@/api/leader-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import {
  AgentMark,
  Composer,
} from "./managed-agent-chat-parts";
import { useManagedActions } from "./use-managed-actions";
import { sendManagedVoice, useManagedSend } from "./use-managed-send";
import { ManagedAgentConfigurationFields } from "./managed-agent-configuration";
import { ManagedAgentHistory } from "./managed-agent-history";
import { ManagedVoiceChat, type ManagedVoiceControl } from "./managed-voice-chat";
import { ChatAccessPicker } from "./chat-access-picker";
import { useChatPanel } from "@/state/chat-panel";
import { useChatAccess } from "@/state/chat-access";
import "./leader-chat.css";
import "./managed-agent-chat.css";
type S = components["schemas"];
export function ManagedAgentChat({
  api,
  agentId,
  legacyApi,
  teamId,
  starters,
  mode = "chat",
  conversationId,
  freshConversation = false,
  resetGeneration = 0,
  onConversationChange,
  beforeComposer,
  voiceLabel,
}: {
  api: ManagedAgentApi;
  agentId: string;
  legacyApi?: LeaderChatApi;
  teamId?: string;
  /** Offer Bee Team onboarding prompts in an empty conversation. */
  starters?: boolean;
  mode?: "chat" | "management";
  /** Externally selected session; null asks for a new or restored conversation. */
  conversationId?: string | null;
  freshConversation?: boolean;
  resetGeneration?: number;
  onConversationChange?: (conversationId: string | null) => void;
  beforeComposer?: (currentLeaderId: string) => ReactNode;
  voiceLabel?: string;
}) {
  useLocale();
  const queryClient = useQueryClient();
  const voiceControl = useRef<ManagedVoiceControl | null>(null);
  const [voiceScrollRequest, setVoiceScrollRequest] = useState(0);
  const config = useQuery({
    queryKey: ["managed-config", agentId],
    queryFn: () => api.config(agentId),
  });
  const conversations = useInfiniteQuery({
    queryKey: ["managed-conversations", agentId],
    queryFn: ({ pageParam }) => api.conversations(agentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 3000,
  });
  const requests = useInfiniteQuery({
    queryKey: ["managed-requests", agentId],
    queryFn: ({ pageParam }) => api.requests(agentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 1500,
  });
  const conversationItems = conversations.data?.pages.flatMap((page) => page.items) ?? [];
  const requestItems = requests.data?.pages.flatMap((page) => page.items) ?? [];
  const [conversation, setConversation] = useState("");
  const sendScope = (conversationId ?? conversation)
    ? `conversation:${conversationId ?? conversation}`
    : `draft:${teamId ?? ""}:${resetGeneration}`;
  const { pending, send: sendPending, acknowledge } = useManagedSend(agentId, api, sendScope);
  const [request, setRequest] = useState(""),
    [draft, setDraft] = useState(() => (pending?.context.resetGeneration ?? 0) === resetGeneration ? pending?.body.content ?? "" : "");
  const pendingHere = !!pending;
  const draftAccessKey = `draft:${teamId ?? ""}:${agentId}`;
  const accessKey = conversation || draftAccessKey;
  const accessMode = useChatAccess(
    (state) => state.byChat[accessKey] ?? state.defaultMode,
  );
  const selection = useRef({ teamId, conversation, externalConversation: conversationId, resetGeneration });
  useLayoutEffect(() => {
    selection.current = { teamId, conversation, externalConversation: conversationId, resetGeneration };
  }, [teamId, conversation, conversationId, resetGeneration]);
  const pendingText = pending?.context.source === "voice" ? undefined : pending?.body.content;
  useEffect(() => {
    if (pendingText !== undefined && (pending?.context.conversation === conversation || (pending?.context.resetGeneration ?? 0) === resetGeneration)) setDraft(pendingText);
  }, [pendingText, pending?.context.resetGeneration, resetGeneration, pending?.context.conversation, conversation]);
  const [search, setSearch] = useState<"live" | "cached" | "disabled">("live"),
    [network, setNetwork] = useState(!!teamId && mode === "chat"),
    [mcps, setMcps] = useState(""),
    [skills, setSkills] = useState("");
  const [editing, setEditing] = useState(false),
    [legacy, setLegacy] = useState("");
  const legacyChats = useQuery({
    queryKey: ["legacy-history", teamId],
    queryFn: () => legacyApi!.list(teamId!),
    enabled: !!legacyApi && !!teamId,
  });
  const legacySnapshot = useQuery({
    queryKey: ["legacy-history-snapshot", legacy],
    queryFn: () => legacyApi!.snapshot(legacy),
    enabled: !!legacyApi && !!legacy,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [older, setOlder] = useState<S["Message"][]>([]);
  const managedActions = useManagedActions();
  const action = managedActions.actions.find((item) => item.agentId === agentId);
  async function mutate(
    signature: string,
    run: (key: string) => Promise<unknown>,
  ) {
    return managedActions.run(agentId, signature, run);
  }
  const snapshot = useQuery({
    queryKey: ["managed-snapshot", request],
    queryFn: () => api.snapshot(request),
    enabled: !!request,
    refetchInterval: request ? 800 : false,
  });
  const history = useQuery({
    queryKey: ["managed-history", conversation],
    queryFn: () => api.messages(conversation),
    enabled: !!conversation && !request,
  });
  const needsConversationDetail = mode === "chat" && !!teamId && !!conversation;
  const detail = useQuery({
    queryKey: ["managed-conversation", conversation],
    queryFn: () => api.conversation(conversation),
    enabled: needsConversationDetail,
    refetchInterval: needsConversationDetail ? 5000 : false,
  });
  const page = request ? snapshot.data?.messages : history.data;
  const current = snapshot.data?.request;
  const restored = useRef(false);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    setOlder([]);
    setOlderCursor(undefined);
  }, [conversation]);
  const select = useCallback((id: string, requestId = "") => {
    setConversation(id);
    setRequest(requestId);
    onConversationChange?.(id || null);
  }, [onConversationChange]);
  useEffect(() => {
    if (
      mode !== "chat" ||
      !pending ||
      (pending.state !== "completed" && pending.state !== "rejected")
    )
      return;
    // External selection must settle before consuming a retained delivery result.
    if (conversationId && conversation !== conversationId) return;
    if (!acknowledge(pending.key)) return;
    const selectedConversation = selection.current.externalConversation === undefined
      ? selection.current.conversation : selection.current.externalConversation;
    const sameSelection = (pending.context.resetGeneration ?? 0) === selection.current.resetGeneration ||
      (!!pending.context.conversation && pending.context.conversation === selectedConversation &&
        pending.context.teamId === selection.current.teamId);
    if (pending.state === "rejected") {
      if (!sameSelection) return;
      if (pending.context.source !== "voice") setDraft(pending.body.content);
      setError(pending.error);
      return;
    }
    if (sameSelection && !pending.context.conversation && pending.context.teamId)
      useChatAccess.getState().moveChoice(
        `draft:${pending.context.teamId}:${agentId}`,
        pending.request.conversationId,
      );
    const current = selection.current;
    const context = pending.context;
    if (
      sameSelection &&
      current.teamId === context.teamId &&
      (current.conversation === context.conversation || selectedConversation === context.conversation) &&
      current.externalConversation === context.externalConversation
    ) {
      voiceControl.current?.adoptConversation?.(pending.request.conversationId);
      select(pending.request.conversationId, pending.request.id);
    }
    if (sameSelection && pending.context.source !== "voice") setDraft("");
  }, [acknowledge, agentId, conversation, conversationId, mode, pending, select]);
  const latestRequest = (id: string) =>
    requestItems.find((r) => r.conversationId === id)?.id ?? "";
  useEffect(() => {
    if (freshConversation) {
      restored.current = true;
      setDraft("");
      setError(null);
      setBusy(false);
      setLegacy("");
      setOlderCursor(undefined);
      setConversation("");
      setRequest("");
      setOlder([]);
      return;
    }
    if (conversationId === undefined || (conversationId ?? "") === conversation)
      return;
    if (!conversationId && !restored.current) return;
    restored.current = true;
    setConversation(conversationId ?? "");
    setRequest(conversationId ? latestRequest(conversationId) : "");
    setOlder([]);
  }, [conversationId, freshConversation, resetGeneration]);
  useEffect(() => {
    if (freshConversation || restored.current || !requests.data || !conversations.data) return;
    restored.current = true;
    const pendingRequest = requestItems.find((r) => ["uncertain", "awaiting_approval"].includes(r.state));
    if (pendingRequest) {
      select(pendingRequest.conversationId, pendingRequest.id);
      return;
    }
    const latestConversation = conversationItems[0];
    if (latestConversation) {
      select(latestConversation.id, latestRequest(latestConversation.id));
      return;
    }
    const latest = requestItems[0];
    if (latest) select(latest.conversationId, latest.id);
  }, [requests.data, conversations.data, freshConversation]);
  useEffect(() => {
    if (!conversation || request) return;
    const latest = latestRequest(conversation);
    if (latest) setRequest(latest);
  }, [conversation, request, requests.data]);
  async function act(fn: () => Promise<unknown>) {
    const generation = resetGeneration;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([
        config.refetch(),
        conversations.refetch(),
        requests.refetch(),
        request ? snapshot.refetch() : Promise.resolve(),
        !request && conversation ? history.refetch() : Promise.resolve(),
        needsConversationDetail ? detail.refetch() : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["managed-sessions"] }),
      ]);
    } catch (e) {
      if (selection.current.resetGeneration === generation) setError(e);
    } finally {
      if (selection.current.resetGeneration === generation) setBusy(false);
    }
  }
  const split = (value: string) =>
    value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  const teamChat = mode === "chat" && !!teamId;
  const ready = !!config.data && (teamChat || !!config.data.configuration);
  const currentConversation =
    detail.data ?? conversationItems.find((c) => c.id === conversation);
  const previousLeader = !!currentConversation && !!teamId &&
    currentConversation.teamId === teamId &&
    currentConversation.agentId !== agentId;
  const readOnly = !!currentConversation &&
    (currentConversation.readOnly || (!!teamId && currentConversation.agentId !== agentId));
  const waitingForDetail = needsConversationDetail && !detail.data;
  const messages = [...older, ...(page?.items ?? [])].filter(
    (m, i, all) => all.findIndex((x) => x.id === m.id) === i,
  );
  const conversationRequests =
    requestItems.filter((r) => r.conversationId === conversation);
  const pendingApprovals =
    snapshot.data?.approvals.filter((a) => a.state === "pending") ?? [];
  const canSend =
    !busy &&
    !readOnly &&
    (!waitingForDetail || !!pending) &&
    (pending ? pendingHere && pending.state === "uncertain" :
      (!!draft.trim() && new TextEncoder().encode(draft).length <= 65536));
  function send(content = draft, starter = false) {
    if (!ready || busy || readOnly || voiceControl.current?.starting ||
      (waitingForDetail && !pending) ||
      (pending ? !pendingHere || starter || pending.state !== "uncertain" :
        (!content.trim() || new TextEncoder().encode(content).length > 65536))) return;
    void act(async () => {
      const body: S["SendAgentRequest"] = {
        content,
        ...(teamId ? { accessMode } : {}),
        ...(conversation
          ? { conversationId: conversation }
          : { ...(teamId ? { teamId } : {}) }),
      };
      await sendPending(body, {
        teamId,
        conversation,
        externalConversation: conversationId,
        resetGeneration,
      });
    });
  }
  function openSettings() {
    const c = config.data!.configuration!;
    setSearch(c.toolProfile.webSearch);
    setNetwork(c.toolProfile.networkAccess);
    setMcps(c.toolProfile.enabledMcpServers.join("\n"));
    setSkills(c.toolProfile.skillRoots.join("\n"));
    setEditing(!editing);
  }
  const failure = error || config.error || conversations.error || history.error || snapshot.error || requests.error || detail.error;
  const showHistory = ready || mode === "management";
  return (
    <section
      className="leader-chat managed-agent-chat"
      aria-label={t("managed.title")}
    >
      {showHistory && (
        <div className="assistant-toolbar">
          {teamChat ? (
            <span className="assistant-session-title" title={currentConversation?.title}>
              {conversation
                ? currentConversation?.title ?? t("sessions.loading")
                : t("managed.new")}
            </span>
          ) : <select
            className="assistant-pill"
            aria-label={t("managed.conversation")}
            value={conversation}
            disabled={!!pending}
            onChange={(e) =>
              select(e.target.value, latestRequest(e.target.value))
            }
          >
            <option value="">{t(mode === "management" ? "managed.chooseConversation" : "managed.new")}</option>
            {currentConversation && !conversationItems.some((item) => item.id === currentConversation.id) && (
              <option value={currentConversation.id}>
                {currentConversation.title}
                {readOnly ? " · " + t("managed.readonly") : ""}
              </option>
            )}
            {conversationItems.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.readOnly ? " · " + t("managed.readonly") : ""}
              </option>
            ))}
          </select>}
          {!teamChat && conversationRequests.length > 1 && (
            <select
              className="assistant-pill assistant-pill-narrow"
              aria-label={t("managed.request")}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            >
              {conversationRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {t(`managed.${r.state}`)} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          )}
          {((!teamChat && conversations.hasNextPage) || requests.hasNextPage) && (
            <div className="assistant-history-pages">
              {!teamChat && conversations.hasNextPage && (
                <Button type="button" variant="ghost" size="sm" disabled={conversations.isFetchingNextPage} onClick={() => void conversations.fetchNextPage()}>
                  {t("managed.moreConversations")}
                </Button>
              )}
              {requests.hasNextPage && (
                <Button type="button" variant="ghost" size="sm" disabled={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>
                  {t("managed.moreRequests")}
                </Button>
              )}
            </div>
          )}
          {mode === "chat" && !teamChat && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("managed.new")}
              title={t("managed.new")}
              disabled={!!pending}
              onClick={() => {
                select("");
                setOlder([]);
              }}
            >
              <SquarePen />
            </Button>
          )}
          {!!config.data?.configuration && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("managed.edit")}
              title={t("managed.edit")}
              aria-expanded={editing}
              onClick={openSettings}
            >
              <Settings2 />
            </Button>
          )}
        </div>
      )}
      {failure && (
        <div role="alert" className="assistant-alert">
          {t("managed.error")}
          <details>
            <summary>{t("chat.errorDetails")}</summary>
            {String(failure)}
          </details>
        </div>
      )}
      {config.isPending && <p role="status">{t("managed.loadingExecution")}</p>}
      {action && !action.running && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const p = action;
              await mutate(p.signature, p.run);
            })
          }
        >
          {t("managed.retryActionButton")}
        </Button>
      )}
      {config.data && (!ready || editing) && (
        <form
          className="assistant-setup"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              if (!config.data) return;
              const version = config.data.version;
              const body: S["ExecutionConfiguration"] = {
                provider: "codex",
                toolProfile: {
                  webSearch: search,
                  networkAccess: network,
                  enabledMcpServers: split(mcps),
                  skillRoots: split(skills),
                },
              };
              await mutate(`configure:${version}`, async (key) => {
                const result = await api.configure(agentId, body, version, key);
                setEditing(false);
                return result;
              });
            });
          }}
        >
          {!ready && <AgentMark size="lg" />}
          <p>{t(mode === "management" ? "managed.setupManagement" : "managed.setup")}</p>
          <ManagedAgentConfigurationFields
            search={search}
            network={network}
            mcps={mcps}
            skills={skills}
            disabled={busy || !!action}
            showNetwork={!teamId || mode !== "chat"}
            showTools={!teamId || mode !== "chat"}
            onSearch={setSearch}
            onNetwork={setNetwork}
            onMcps={setMcps}
            onSkills={setSkills}
          />
          <Button type="submit" disabled={busy || !config.data || !!action}>
            {t("managed.configure")}
          </Button>
        </form>
      )}
      {!!legacyChats.data?.items.length && (
        <details className="assistant-legacy">
          <summary>{t("managed.legacy")}</summary>
          <select
            aria-label={t("managed.legacy")}
            value={legacy}
            onChange={(e) => setLegacy(e.target.value)}
          >
            <option value="">—</option>
            {legacyChats.data.items
              .filter((c) => c.leaderAgentId === agentId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          {legacySnapshot.data?.messages.map((m) => (
            <article key={m.id}>
              <Markdown copyTables>{m.content}</Markdown>
            </article>
          ))}
        </details>
      )}
      {showHistory && (
        <>
          <ManagedAgentHistory
            scrollToBottomRequest={voiceScrollRequest}
            page={page}
            messages={messages}
            current={current}
            approvals={pendingApprovals}
            busy={busy}
            showWelcome={mode === "chat" && !conversation && !messages.length && !current}
            starters={!!starters}
            empty={mode === "management" && conversations.isSuccess && conversationItems.length === 0}
            hasOlder={!!(olderCursor === undefined ? page?.nextCursor : olderCursor)}
            onPick={(prompt) => send(prompt, true)}
            onOlder={() => void act(async () => {
              const cursor = olderCursor === undefined ? page?.nextCursor : olderCursor;
              if (!cursor) return;
              const generation = resetGeneration;
              const p = await api.messages(conversation, cursor);
              if (selection.current.resetGeneration !== generation || selection.current.conversation !== conversation) return;
              setOlder((old) => [...p.items, ...old]);
              setOlderCursor(p.nextCursor);
            })}
            onControl={(selected) => void act(() =>
              selected.state === "uncertain"
                ? mutate(`reconcile:${selected.id}`, (key) => api.reconcile(selected.id, selected.version, key))
                : mutate(`cancel:${selected.id}`, (key) => api.cancel(selected.id, selected.version, key))
            )}
            onDecide={(approval, decision) => void act(() =>
              mutate(`decision:${approval.id}:${decision}`, (key) => api.decide(approval.id, approval.version, decision, key))
            )}
            onRecover={(message) => void act(() =>
              mutate(`recover-files:${message.id}:${message.version}`, async (key) => {
                const updated = await api.recoverFiles(message.conversationId, message.id, message.version, key);
                setOlder((old) => old.map((item) => item.id === updated.id ? updated : item));
                return updated;
              })
            )}
          />
          {mode === "chat" && (
            <>
              {previousLeader && <p className="assistant-readonly">{t("managed.previousLeader")}</p>}
              {pendingHere && pending?.state === "uncertain" && (
                <p className="assistant-readonly" role="status">{t("managed.pendingSend")}</p>
              )}
              <ManagedVoiceChat controlRef={voiceControl} api={api} agentId={agentId} teamId={teamId} contextMessages={messages}
                label={[currentConversation?.title ?? t("managed.new"), voiceLabel].filter(Boolean).join(" · ")}
                onReturn={(id) => {
                  if (teamId) useChatPanel.getState().openConversation(teamId, id);
                  else select(id);
                }}
                onSelect={(id, requestId) => {
                  select(id, requestId);
                }}
                onActivate={() => setVoiceScrollRequest((value) => value + 1)}
                conversation={conversation} selectionToken={conversationId ?? `new:${resetGeneration}`} accessMode={accessMode}
                disabled={!ready || busy || !!pending || waitingForDetail || readOnly}
                readOnly={readOnly}
                onAssociated={(id) => {
                  if (!conversation && teamId) useChatAccess.getState().choose(id, accessMode);
                  void queryClient.invalidateQueries({ queryKey: ["managed-history", id] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-conversations", agentId] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-sessions"] });
                }}
                onTranscript={(id) => {
                  void queryClient.invalidateQueries({ queryKey: ["managed-history", id] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-conversation", id] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-conversations", agentId] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-sessions"] });
                  if (request) void queryClient.invalidateQueries({ queryKey: ["managed-snapshot", request] });
                }}
                onSend={(body) => sendManagedVoice(queryClient, agentId, api, body, { teamId, conversation: body.conversationId ?? "", externalConversation: conversationId, resetGeneration, source: "voice" })}
                onQueued={() => {
                  void queryClient.invalidateQueries({ queryKey: ["managed-requests", agentId] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-conversations", agentId] });
                  void queryClient.invalidateQueries({ queryKey: ["managed-sessions"] });
                }}>
                {(voice) => <>
                {beforeComposer?.(currentConversation?.agentId ?? agentId)}
                <Composer
                voice={voice}
                value={draft}
                onChange={setDraft}
                onSubmit={() => send()}
                locked={!!pending || waitingForDetail || !!voice.starting}
                canSend={canSend && !voice.starting}
                retry={pendingHere}
                readOnly={readOnly}
                accessControl={teamId ? (
                  <ChatAccessPicker
                    chatId={accessKey}
                    disabled={busy || !!pending || readOnly}
                  />
                ) : undefined}
              /></>}
              </ManagedVoiceChat>
            </>
          )}
        </>
      )}
    </section>
  );
}
