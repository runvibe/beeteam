import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderChatApi } from "@/api/leader-chat";
import type {
  AgentRuntime,
  Approval,
  Chat,
  SendMessage,
  Snapshot,
  Turn,
} from "@/api/leader-chat-types";
import { ApiError } from "@/api/types";
import { t as tr } from "@/i18n";
import {
  applyApproval,
  applyChatEvent,
  applyTurn,
  mergeMessages,
} from "./leader-chat-state";

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}
export function useLeaderChat(
  api: LeaderChatApi | undefined,
  teamId: string,
  leaderAgentId: string,
) {
  const [runtime, setRuntime] = useState<AgentRuntime | null>(null),
    [chats, setChats] = useState<Chat[]>([]),
    [nextChats, setNextChats] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState<unknown>(null),
    [loading, setLoading] = useState(false),
    [working, setWorking] = useState(false),
    [connection, setConnection] = useState<
      "connecting" | "connected" | "reconnecting" | "stopped"
    >("connecting");
  const [epoch, setEpoch] = useState(0),
    [sendUncertain, setSendUncertain] = useState(false);
  const [resolvedSend, setResolvedSend] = useState(0);
  const pending = useRef<{
    chatId: string;
    key: string;
    body: SendMessage;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const busy = useRef(false);
  const reconciliation = useRef<{chatId:string;turn:Turn;key:string}|null>(null);
  const [unresolvedChat, setUnresolvedChat] = useState<string|null>(null);
  const refresh = useCallback(() => setEpoch((v) => v + 1), []);
  useEffect(() => {
    if (
      pending.current?.chatId === snapshot?.chat.id &&
      snapshot?.messages.some(
        (m) => m.clientMessageId === pending.current?.body.clientMessageId,
      )
    ) {
      pending.current = null;
      setSendUncertain(false);
      setResolvedSend((v) => v + 1);
    }
  }, [snapshot]);
  useEffect(() => {
    if (!api) return;
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      api.runtime(leaderAgentId, abort.signal),
      api.list(teamId, undefined, abort.signal),
    ])
      .then(([r, p]) => {
        if (abort.signal.aborted) return;
        setRuntime(r);
        setChats(p.items);
        setNextChats(p.nextCursor);
        setChatId(
          (previous) =>
            previous ??
            p.items.find((c) => c.bindingId === r.bindingId)?.id ??
            p.items[0]?.id ??
            null,
        );
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [api, teamId, leaderAgentId, epoch]);
  useEffect(() => {
    if (!api) return;
    const abort = new AbortController();
    let running = false;
    const poll = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const value = await api.runtime(leaderAgentId, abort.signal);
        if (!abort.signal.aborted) setRuntime(value);
      } catch {
        /* Keep last verified runtime; commands still enforce binding/version. */
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void poll(), 15000);
    return () => {
      clearInterval(timer);
      abort.abort();
    };
  }, [api, leaderAgentId]);
  useEffect(() => {
    setSnapshot(null);
    setError(null);
    if (!api || !chatId) return;
    const abort = new AbortController();
    let cursor = "",
      failures = 0,
      protocolFailures = 0;
    const seen = new Set<string>();
    async function follow() {
      while (!abort.signal.aborted) {
        try {
          if (!cursor) {
            setConnection("connecting");
            const value = await api!.snapshot(chatId!, abort.signal);
            if (abort.signal.aborted) return;
            setSnapshot(value);
            snapshotRef.current = value;
            cursor = value.eventCursor;
          }
          setConnection(failures ? "reconnecting" : "connecting");
          await api!.stream(
            chatId!,
            cursor,
            abort.signal,
            (event) => {
              if (abort.signal.aborted || seen.has(event.id)) return;
              seen.add(event.id);
              if (seen.size > 2000) seen.delete(seen.values().next().value!);
              cursor = event.id;
              failures = 0;
              setConnection("connected");
              setSnapshot((state) =>
                state ? applyChatEvent(state, event) : state,
              );
            },
            () => {
              if (!abort.signal.aborted) setConnection("connected");
            },
          );
          if (abort.signal.aborted) return;
        } catch (e) {
          if (abort.signal.aborted) return;
          if (e instanceof ApiError && e.code === "cursor_expired") {
            cursor = "";
            seen.clear();
            continue;
          }
          if (
            e instanceof ApiError &&
            e.code === "incompatible_stream" &&
            protocolFailures++ === 0
          ) {
            cursor = "";
            seen.clear();
            continue;
          }
          if (
            e instanceof ApiError &&
            (e.status === 403 ||
              e.status === 404 ||
              e.status === 400 ||
              e.code === "incompatible_stream")
          ) {
            setError(e);
            setConnection("stopped");
            return;
          }
        }
        setConnection("reconnecting");
        await wait(
          Math.min(
            [1000, 2000, 5000, 10000][Math.min(failures++, 3)] *
              (failures > 4 ? 3 : 1),
            30000,
          ) *
            (0.8 + Math.random() * 0.4),
          abort.signal,
        );
      }
    }
    void follow();
    return () => abort.abort();
  }, [api, chatId, epoch]);
  async function action<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  async function start() {
    if (!api || !runtime?.bindingId) return;
    const result = await action(() =>
      api.create(
        {
          teamId,
          leaderAgentId,
          bindingId: runtime.bindingId!,
          title: tr("chat.title"),
        },
        crypto.randomUUID(),
      ),
    );
    if (result) {
      setChats((items) => [result, ...items.filter((c) => c.id !== result.id)]);
      setChatId(result.id);
      refresh();
    }
  }
  async function send(content: string) {
    if (!api || !chatId || !snapshotRef.current || busy.current) return false;
    if (pending.current && pending.current.chatId !== chatId) return false;
    pending.current ??= {
      chatId,
      key: crypto.randomUUID(),
      body: {
        clientMessageId: crypto.randomUUID(),
        bindingId: snapshotRef.current.chat.bindingId,
        content,
      },
    };
    const request = pending.current;
    busy.current = true;
    setWorking(true);
    setError(null);
    try {
      const result = await api.send(chatId, request.body, request.key);
      pending.current = null;
      setSendUncertain(false);
      setSnapshot((state) =>
        state?.chat.id === chatId
          ? applyTurn(
              {
                ...state,
                messages: mergeMessages(state.messages, [result.message]),
              },
              result.turn,
            )
          : state,
      );
      return true;
    } catch (e) {
      if (!pending.current) return true;
      setError(e);
      const ambiguous =
        !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.code === "invalid_response";
      if (!ambiguous) pending.current = null;
      setSendUncertain(ambiguous);
      return false;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  async function older() {
    if (!api || !chatId || !snapshot?.olderMessagesCursor) return;
    const page = await action(() =>
      api.messages(chatId, snapshot.olderMessagesCursor!),
    );
    if (page)
      setSnapshot((state) =>
        state?.chat.id === chatId
          ? {
              ...state,
              messages: mergeMessages(state.messages, page.items),
              olderMessagesCursor: page.nextCursor,
            }
          : state,
      );
  }
  async function moreChats() {
    if (!api || !nextChats) return;
    const page = await action(() => api.list(teamId, nextChats));
    if (page) {
      setChats((current) => [
        ...current,
        ...page.items.filter((c) => !current.some((old) => old.id === c.id)),
      ]);
      setNextChats(page.nextCursor);
    }
  }
  async function reconcile() {
    const turn = snapshotRef.current?.activeTurn;
    if (!api || !chatId || !turn || turn.status !== "uncertain" || busy.current) return;
    if (reconciliation.current?.chatId !== chatId || reconciliation.current?.turn.id !== turn.id)
      reconciliation.current = {chatId, turn, key:crypto.randomUUID()};
    const pending = reconciliation.current;
    await action(async () => {
      try {
        const result = await api.reconcile(chatId, pending.turn, pending.key);
        reconciliation.current = null;
        setUnresolvedChat(result.resolved ? null : `${chatId}:${pending.turn.id}`);
        setSnapshot(state => state?.chat.id === chatId ? applyTurn(state,result.turn) : state);
      } catch(error) {
        if (error instanceof ApiError && error.status > 0 && error.status < 500 && error.code !== "invalid_response") reconciliation.current = null;
        throw error;
      }
    });
  }
  async function cancel() {
    if (!api || !chatId || !snapshot?.activeTurn) return;
    const result = await action(() =>
      api.cancel(chatId, snapshot.activeTurn!, crypto.randomUUID()),
    );
    if (result)
      setSnapshot((state) =>
        state?.chat.id === chatId ? applyTurn(state, result) : state,
      );
  }
  async function decide(approval: Approval, decision: "accept" | "decline") {
    if (!api || !chatId) return;
    const result = await action(() =>
      api.decide(chatId, approval, decision, crypto.randomUUID()),
    );
    if (result)
      setSnapshot((state) =>
        state?.chat.id === chatId ? applyApproval(state, result) : state,
      );
    else refresh();
  }
  return {
    runtime,
    chats,
    nextChats,
    chatId,
    setChatId,
    snapshot,
    error,
    loading,
    working,
    connection,
    sendUncertain,
    resolvedSend,
    refresh,
    start,
    send,
    older,
    moreChats,
    cancel,
    reconcile,
    reconciliationUnresolved: unresolvedChat === `${chatId}:${snapshot?.activeTurn?.id}`,
    decide,
  };
}
