import { createTransport, type HttpOptions } from "./http-transport";
import { ApiError } from "./types";
import { message } from "@/i18n";
import {
  SseDecoder,
  decodeChatEvent,
  protocolError,
} from "./leader-chat-stream";
import type {
  AgentRuntime,
  Approval,
  Chat,
  ChatPage,
  ChatEvent,
  CreateChat,
  MessagePage,
  SendMessage,
  SendResult,
  Snapshot,
  Turn,
  CreateIntegratedSession,
  IntegratedSession,
} from "./leader-chat-types";
const segment = encodeURIComponent;
export interface LeaderChatApi {
  createSession(
    agentId: string,
    body: CreateIntegratedSession,
    version: number,
    key: string,
  ): Promise<IntegratedSession>;
  runtime(agentId: string, signal?: AbortSignal): Promise<AgentRuntime>;
  list(
    teamId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ChatPage>;
  create(body: CreateChat, key: string): Promise<Chat>;
  snapshot(chatId: string, signal?: AbortSignal): Promise<Snapshot>;
  messages(
    chatId: string,
    cursor: string,
    signal?: AbortSignal,
  ): Promise<MessagePage>;
  send(chatId: string, body: SendMessage, key: string): Promise<SendResult>;
  cancel(chatId: string, turn: Turn, key: string): Promise<Turn>;
  decide(
    chatId: string,
    approval: Approval,
    decision: "accept" | "decline",
    key: string,
  ): Promise<Approval>;
  stream(
    chatId: string,
    cursor: string,
    signal: AbortSignal,
    onEvent: (event: ChatEvent) => void,
    onOpen?: () => void,
  ): Promise<void>;
}
export function createLeaderChatApi(options: HttpOptions = {}): LeaderChatApi {
  const base = (options.baseUrl ?? "/api/v1")
    .replace(/\/$/, "")
    .replace(/\/v1$/, "/v2");
  const request = createTransport({ ...options, baseUrl: base });
  const fetcher =
    options.fetch ??
    ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const write = <T>(
    path: string,
    body: unknown,
    key: string,
    version?: number,
  ) =>
    request<T>(path, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        "Idempotency-Key": key,
        ...(version === undefined ? {} : { "If-Match": `"${version}"` }),
      },
    });
  const chatPath = (id: string) => `/leader-chats/${segment(id)}`;
  return {
    createSession: (agentId, body, version, key) =>
      write(
        `/agents/${segment(agentId)}/integrated-session`,
        body,
        key,
        version,
      ),
    runtime: (agentId, signal) =>
      request(`/agents/${segment(agentId)}/runtime`, { signal }),
    list: (teamId, cursor, signal) =>
      request(
        "/leader-chats?" +
          new URLSearchParams({ teamId, ...(cursor ? { cursor } : {}) }),
        { signal },
      ),
    create: (body, key) => write("/leader-chats", body, key),
    snapshot: (id, signal) => request(chatPath(id), { signal }),
    messages: (id, cursor, signal) =>
      request(chatPath(id) + "/messages?" + new URLSearchParams({ cursor }), {
        signal,
      }),
    send: (id, body, key) => write(chatPath(id) + "/messages", body, key),
    cancel: (id, turn, key) =>
      write(
        chatPath(id) + `/turns/${segment(turn.id)}/cancel`,
        undefined,
        key,
        turn.version,
      ),
    decide: (id, approval, decision, key) =>
      write(
        chatPath(id) + `/approvals/${segment(approval.id)}/decision`,
        { decision },
        key,
        approval.version,
      ),
    async stream(id, cursor, signal, onEvent, onOpen) {
      const response = await fetcher(
        base +
          chatPath(id) +
          "/events?" +
          new URLSearchParams({ after: cursor }),
        {
          signal,
          credentials: "omit",
          headers: { Accept: "text/event-stream", "Last-Event-ID": cursor },
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(
          response.status,
          body?.code ?? "http_error",
          body?.error ?? message("chat.connectionFailed"),
        );
      }
      if (
        !response.body ||
        !response.headers.get("Content-Type")?.includes("text/event-stream")
      )
        throw protocolError();
      onOpen?.();
      const reader = response.body.getReader(),
        decoder = new TextDecoder(),
        frames = new SseDecoder();
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const frame of frames.push(
            decoder.decode(value, { stream: true }),
          ))
            onEvent(decodeChatEvent(frame, id));
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
}
