import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import type { LeaderChatApi } from "@/api/leader-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { ApiError } from "@/api/types";
import "./leader-chat.css";
import "./managed-agent-chat.css";
type S = components["schemas"];
export function ManagedAgentChat({
  api,
  agentId,
  legacyApi,
  teamId,
}: {
  api: ManagedAgentApi;
  agentId: string;
  legacyApi?: LeaderChatApi;
  teamId?: string;
}) {
  useLocale();
  const config = useQuery({
    queryKey: ["managed-config", agentId],
    queryFn: () => api.config(agentId),
  });
  const conversations = useQuery({
    queryKey: ["managed-conversations", agentId],
    queryFn: () => api.conversations(agentId),
    refetchInterval: 3000,
  });
  const requests = useQuery({
    queryKey: ["managed-requests", agentId],
    queryFn: () => api.requests(agentId),
    refetchInterval: 1500,
  });
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
  const action = useRef<{
    signature: string;
    key: string;
    run: (key: string) => Promise<unknown>;
  } | null>(null);
  async function mutate(
    signature: string,
    run: (key: string) => Promise<unknown>,
  ) {
    if (action.current && action.current.signature !== signature)
      throw new Error(t("managed.retryAction"));
    action.current ??= { signature, key: crypto.randomUUID(), run };
    const p = action.current;
    try {
      const result = await p.run(p.key);
      action.current = null;
      return result;
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      )
        action.current = null;
      throw e;
    }
  }
  const setup = useRef<{
    key: string;
    body: S["ExecutionConfiguration"];
    version: number;
  } | null>(null);
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
  const bottom = useRef<HTMLDivElement>(null);
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
        requests.data.items.find((r) =>
          ["uncertain", "awaiting_approval"].includes(r.state),
        ) ?? requests.data.items[0];
      if (!first) return;
      const r = first;
      setConversation(r.conversationId);
      setRequest(r.id);
    }
  }, [requests.data]);
  const scroll = useRef(true);
  useEffect(() => {
    if (scroll.current) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [page]);
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
  const readOnly = conversations.data?.items.find(
    (c) => c.id === conversation,
  )?.readOnly;
  return (
    <section
      className="leader-chat managed-agent-chat"
      aria-label={t("managed.title")}
    >
      {(error || config.error || snapshot.error || requests.error) && (
        <div role="alert">
          {t("managed.error")}
          <details>
            <summary>{t("chat.errorDetails")}</summary>
            {String(error || config.error || snapshot.error || requests.error)}
          </details>
        </div>
      )}
      {action.current && (
        <Button
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const p = action.current!;
              await mutate(p.signature, p.run);
            })
          }
        >
          {t("managed.retryActionButton")}
        </Button>
      )}
      {!!legacyChats.data?.items.length && (
        <details>
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
      {ready && (
        <Button
          variant="ghost"
          onClick={() => {
            const c = config.data!.configuration!;
            setSearch(c.toolProfile.webSearch);
            setNetwork(c.toolProfile.networkAccess);
            setMcps(c.toolProfile.enabledMcpServers.join("\n"));
            setSkills(c.toolProfile.skillRoots.join("\n"));
            setEditing(!editing);
          }}
        >
          {t("managed.edit")}
        </Button>
      )}
      {(!ready || editing) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              if (!config.data) return;
              setup.current ??= {
                key: crypto.randomUUID(),
                version: config.data.version,
                body: {
                  provider: "codex",
                  toolProfile: {
                    webSearch: search,
                    networkAccess: network,
                    enabledMcpServers: split(mcps),
                    skillRoots: split(skills),
                  },
                },
              };
              const p = setup.current;
              try {
                await api.configure(agentId, p.body, p.version, p.key);
                setup.current = null;
                setEditing(false);
              } catch (e) {
                if (
                  e instanceof ApiError &&
                  e.status >= 400 &&
                  e.status < 500 &&
                  e.status !== 408
                )
                  setup.current = null;
                throw e;
              }
            });
          }}
        >
          <p>{t("managed.setup")}</p>
          <label>
            {t("managed.search")}
            <select
              value={search}
              onChange={(e) => setSearch(e.target.value as typeof search)}
              disabled={busy || !!setup.current}
            >
              {["live", "cached", "disabled"].map((s) => (
                <option key={s} value={s}>
                  {t(`managed.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={network}
              onChange={(e) => setNetwork(e.target.checked)}
              disabled={busy || !!setup.current}
            />
            {t("managed.network")}
          </label>
          <label>
            {t("managed.mcps")}
            <Textarea
              value={mcps}
              onChange={(e) => setMcps(e.target.value)}
              disabled={busy || !!setup.current}
            />
          </label>
          <label>
            {t("managed.skills")}
            <Textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              disabled={busy || !!setup.current}
            />
          </label>
          <Button type="submit" disabled={busy || !config.data}>
            {t("managed.configure")}
          </Button>
        </form>
      )}
      {ready && (
        <>
          <div className="leader-chat-toolbar">
            <label>
              {t("managed.conversation")}
              <select
                value={conversation}
                disabled={!!pending.current}
                onChange={(e) => {
                  setConversation(e.target.value);
                  const r = requests.data?.items.find(
                    (r) => r.conversationId === e.target.value,
                  );
                  setRequest(r?.id ?? "");
                }}
              >
                <option value="">{t("managed.new")}</option>
                {conversations.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.readOnly ? " · " + t("managed.readonly") : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              disabled={!!pending.current}
              onClick={() => {
                setRequest("");
                setConversation("");
                setOlder([]);
              }}
            >
              {t("managed.new")}
            </Button>
          </div>
          <label>
            {t("managed.request")}
            <select
              value={request}
              onChange={(e) => {
                const r = requests.data?.items.find(
                  (r) => r.id === e.target.value,
                );
                if (r) {
                  setRequest(r.id);
                  setConversation(r.conversationId);
                }
              }}
            >
              <option value="">—</option>
              {requests.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {t(`managed.${r.state}`)} · {r.createdAt}
                </option>
              ))}
            </select>
          </label>
          <div
            className="leader-chat-messages"
            onScroll={(e) => {
              const el = e.currentTarget;
              scroll.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {(olderCursor === undefined ? page?.nextCursor : olderCursor) && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const p = await api.messages(
                      conversation,
                      (olderCursor === undefined
                        ? page?.nextCursor
                        : olderCursor)!,
                    );
                    setOlder((old) => [...p.items, ...old]);
                    setOlderCursor(p.nextCursor);
                  })
                }
              >
                {t("managed.older")}
              </Button>
            )}
            {[...older, ...(page?.items ?? [])]
              .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
              .map((m) => (
                <article key={m.id} className={`leader-chat-message ${m.role}`}>
                  <small>{t(`managed.${m.role}`)}</small>
                  <Markdown>{m.content}</Markdown>
                </article>
              ))}
            <div ref={bottom} />
          </div>
          {current && (
            <div role="status">
              {t(`managed.${current.state}`)}
              {current.error && <p>{current.error.message}</p>}
            </div>
          )}
          {snapshot.data?.approvals
            .filter((a) => a.state === "pending")
            .map((a) => (
              <div key={a.id}>
                <p>{a.description}</p>
                {(["accept", "decline"] as const).map((decision) => (
                  <Button
                    key={decision}
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        mutate(`decision:${a.id}:${decision}`, (key) =>
                          api.decide(a.id, a.version, decision, key),
                        ),
                      )
                    }
                  >
                    {t(`managed.${decision}`)}
                  </Button>
                ))}
              </div>
            ))}
          {current &&
            !["completed", "failed", "cancelled"].includes(current.state) && (
              <Button
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    current.state === "uncertain"
                      ? mutate(`reconcile:${current.id}`, (key) =>
                          api.reconcile(current.id, current.version, key),
                        )
                      : mutate(`cancel:${current.id}`, (key) =>
                          api.cancel(current.id, current.version, key),
                        ),
                  )
                }
              >
                {t(
                  current.state === "uncertain"
                    ? "managed.reconcile"
                    : "managed.cancel",
                )}
              </Button>
            )}
          {readOnly && <p>{t("managed.readonly")}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
            }}
          >
            <label>
              {t("managed.message")}
              <Textarea
                value={draft}
                disabled={!!pending.current}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <Button
              disabled={
                busy ||
                readOnly ||
                (!pending.current &&
                  (!draft.trim() ||
                    new TextEncoder().encode(draft).length > 65536))
              }
            >
              {t(pending.current ? "managed.retry" : "managed.send")}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
