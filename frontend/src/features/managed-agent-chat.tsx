import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useManagedSend } from "./use-managed-send";
import { ManagedAgentConfigurationFields } from "./managed-agent-configuration";
import { ManagedAgentHistory } from "./managed-agent-history";
import { SessionBoardPicker } from "./session-board-picker";
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
  onConversationChange,
  boards,
  getBoard,
  hasMoreBoards = false,
  loadingBoards = false,
  onMoreBoards,
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
  onConversationChange?: (conversationId: string | null) => void;
  /** Boards of the team, offered as optional session context. */
  boards?: { id: string; name: string }[];
  getBoard?: (id: string) => Promise<{ id: string; name: string }>;
  hasMoreBoards?: boolean;
  loadingBoards?: boolean;
  onMoreBoards?: () => void;
}) {
  useLocale();
  const queryClient = useQueryClient();
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
  const { pending, send: sendPending, acknowledge } = useManagedSend(agentId, api);
  const [conversation, setConversation] = useState(""),
    [request, setRequest] = useState(""),
    [draft, setDraft] = useState(() => pending?.body.content ?? ""),
    [newBoard, setNewBoard] = useState("");
  const selection = useRef({ teamId, conversation, externalConversation: conversationId });
  useLayoutEffect(() => {
    selection.current = { teamId, conversation, externalConversation: conversationId };
  }, [teamId, conversation, conversationId]);
  const pendingText = pending?.body.content;
  useEffect(() => {
    if (pendingText !== undefined) setDraft(pendingText);
  }, [pendingText]);
  const [search, setSearch] = useState<"live" | "cached" | "disabled">("live"),
    [network, setNetwork] = useState(false),
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
    if (!acknowledge(pending.key)) return;
    if (pending.state === "rejected") {
      setDraft(pending.body.content);
      setError(pending.error);
      return;
    }
    const current = selection.current;
    const context = pending.context;
    if (
      current.teamId === context.teamId &&
      current.conversation === context.conversation &&
      current.externalConversation === context.externalConversation
    ) {
      select(pending.request.conversationId, pending.request.id);
    }
    setDraft("");
    setNewBoard("");
  }, [acknowledge, mode, pending, select]);
  const latestRequest = (id: string) =>
    requestItems.find((r) => r.conversationId === id)?.id ?? "";
  useEffect(() => {
    if (freshConversation) {
      restored.current = true;
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
  }, [conversationId, freshConversation]);
  useEffect(() => {
    if (!freshConversation && !restored.current && requests.data) {
      restored.current = true;
      const first =
        requestItems.find((r) =>
          ["uncertain", "awaiting_approval"].includes(r.state),
        ) ?? requestItems[0];
      if (!first) return;
      const r = first;
      select(r.conversationId, r.id);
    }
  }, [requests.data, requestItems, freshConversation]);
  useEffect(() => {
    if (!conversation || request) return;
    const latest = latestRequest(conversation);
    if (latest) setRequest(latest);
  }, [conversation, request, requests.data]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([
        config.refetch(),
        conversations.refetch(),
        requests.refetch(),
        request ? snapshot.refetch() : Promise.resolve(),
        needsConversationDetail ? detail.refetch() : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["managed-sessions"] }),
      ]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const split = (value: string) =>
    value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  const ready = !!config.data?.configuration;
  const currentConversation =
    detail.data ?? conversationItems.find((c) => c.id === conversation);
  const selectedBoardId = conversation ? currentConversation?.boardId : null;
  const missingBoard = !!selectedBoardId && !boards?.some((board) => board.id === selectedBoardId);
  const boardDetail = useQuery({
    queryKey: ["boards", selectedBoardId],
    queryFn: () => getBoard!(selectedBoardId!),
    enabled: !!getBoard && missingBoard,
  });
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
    (pending ? pending.state === "uncertain" :
      (!!draft.trim() && new TextEncoder().encode(draft).length <= 65536));
  function send() {
    void act(async () => {
      const body: S["SendAgentRequest"] = {
        content: draft,
        ...(conversation
          ? { conversationId: conversation }
          : {
              ...(teamId ? { teamId } : {}),
              ...(teamId && newBoard ? { boardId: newBoard } : {}),
            }),
      };
      await sendPending(body, {
        teamId,
        conversation,
        externalConversation: conversationId,
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
  const failure = error || config.error || conversations.error || history.error || snapshot.error || requests.error || detail.error || boardDetail.error;
  const showHistory = ready || mode === "management";
  const teamChat = mode === "chat" && !!teamId;
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
          {teamChat &&
            (!conversation || currentConversation) && (
              <SessionBoardPicker
                value={conversation ? (currentConversation?.boardId ?? "") : newBoard}
                boards={boards ?? []}
                historicalBoard={missingBoard && selectedBoardId
                  ? { id: selectedBoardId, name: boardDetail.data?.name ?? t("sessions.unknown") }
                  : undefined}
                disabled={busy || !!pending || !!readOnly || waitingForDetail}
                hasMore={hasMoreBoards}
                loading={loadingBoards}
                onMore={onMoreBoards}
                onChange={(next) => {
                  if (!currentConversation) return setNewBoard(next);
                  const c = currentConversation;
                  void act(() =>
                    mutate(`board:${c.id}:${c.version}:${next}`, (key) =>
                      api.updateConversation(
                        c.id,
                        { boardId: next || null },
                        c.version,
                        key,
                      ),
                    ),
                  );
                }}
              />
            )}
          {conversationRequests.length > 1 && (
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
          {mode === "chat" && (
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
          {ready && (
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
              <Markdown>{m.content}</Markdown>
            </article>
          ))}
        </details>
      )}
      {showHistory && (
        <>
          <ManagedAgentHistory
            page={page}
            messages={messages}
            current={current}
            approvals={pendingApprovals}
            busy={busy}
            showWelcome={mode === "chat" && !conversation && !messages.length && !current}
            starters={!!starters}
            empty={mode === "management" && conversations.isSuccess && conversationItems.length === 0}
            hasOlder={!!(olderCursor === undefined ? page?.nextCursor : olderCursor)}
            onPick={setDraft}
            onOlder={() => void act(async () => {
              const cursor = olderCursor === undefined ? page?.nextCursor : olderCursor;
              if (!cursor) return;
              const p = await api.messages(conversation, cursor);
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
          />
          {mode === "chat" && (
            <>
              {previousLeader && <p className="assistant-readonly">{t("managed.previousLeader")}</p>}
              {pending?.state === "uncertain" && (
                <p className="assistant-readonly" role="status">{t("managed.pendingSend")}</p>
              )}
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={send}
                locked={!!pending || waitingForDetail}
                canSend={canSend}
                retry={!!pending}
                readOnly={readOnly}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
