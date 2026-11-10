import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Settings2, SquarePen } from "lucide-react";
import { Markdown } from "@/components/markdown";
import type { LeaderChatApi } from "@/api/leader-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { ApiError } from "@/api/types";
import {
  AgentMark,
  Composer,
} from "./managed-agent-chat-parts";
import { useManagedActions } from "./use-managed-actions";
import { ManagedAgentConfigurationFields } from "./managed-agent-configuration";
import { ManagedAgentHistory } from "./managed-agent-history";
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
}: {
  api: ManagedAgentApi;
  agentId: string;
  legacyApi?: LeaderChatApi;
  teamId?: string;
  /** Offer Bee Team onboarding prompts in an empty conversation. */
  starters?: boolean;
  mode?: "chat" | "management";
}) {
  useLocale();
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
  const [conversation, setConversation] = useState(""),
    [request, setRequest] = useState(""),
    [draft, setDraft] = useState("");
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
  const pending = useRef<{ key: string; body: S["SendAgentRequest"] } | null>(
    null,
  );
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
  useEffect(() => {
    if (!restored.current && requests.data) {
      restored.current = true;
      const first =
        requestItems.find((r) =>
          ["uncertain", "awaiting_approval"].includes(r.state),
        ) ?? requestItems[0];
      if (!first) return;
      const r = first;
      setConversation(r.conversationId);
      setRequest(r.id);
    }
  }, [requests.data, requestItems]);
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
  const readOnly = conversationItems.find(
    (c) => c.id === conversation,
  )?.readOnly;
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
    (!!pending.current ||
      (!!draft.trim() && new TextEncoder().encode(draft).length <= 65536));
  function send() {
    void act(async () => {
      pending.current ??= {
        key: crypto.randomUUID(),
        body: {
          content: draft,
          ...(conversation ? { conversationId: conversation } : {}),
        },
      };
      const p = pending.current;
      try {
        const r = await api.send(agentId, p.body, p.key);
        setConversation(r.conversationId);
        setRequest(r.id);
        setDraft("");
        pending.current = null;
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.status >= 400 &&
          e.status < 500 &&
          e.status !== 408
        )
          pending.current = null;
        throw e;
      }
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
  const failure = error || config.error || conversations.error || history.error || snapshot.error || requests.error;
  const showHistory = ready || mode === "management";
  return (
    <section
      className="leader-chat managed-agent-chat"
      aria-label={t("managed.title")}
    >
      {showHistory && (
        <div className="assistant-toolbar">
          <select
            className="assistant-pill"
            aria-label={t("managed.conversation")}
            value={conversation}
            disabled={!!pending.current}
            onChange={(e) => {
              setConversation(e.target.value);
              const r = requestItems.find(
                (r) => r.conversationId === e.target.value,
              );
              setRequest(r?.id ?? "");
            }}
          >
            <option value="">{t(mode === "management" ? "managed.chooseConversation" : "managed.new")}</option>
            {conversationItems.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.readOnly ? " · " + t("managed.readonly") : ""}
              </option>
            ))}
          </select>
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
          {showHistory && (conversations.hasNextPage || requests.hasNextPage) && (
            <div className="assistant-history-pages">
              {conversations.hasNextPage && (
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
              disabled={!!pending.current}
              onClick={() => {
                setRequest("");
                setConversation("");
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
            <Composer
              value={draft}
              onChange={setDraft}
              onSubmit={send}
              locked={!!pending.current}
              canSend={canSend}
              retry={!!pending.current}
              readOnly={readOnly}
            />
          )}
        </>
      )}
    </section>
  );
}
