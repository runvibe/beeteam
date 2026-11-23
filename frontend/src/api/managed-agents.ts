import { createTransport, type HttpOptions } from "./http-transport";
import type { components } from "./generated/managed-agents";
type S = components["schemas"];
export type ManagedSnapshot = S["RequestSnapshot"];
export type ManagedConversation = S["Conversation"];
export type SessionSort = "updated_desc" | "updated_asc";
/** Team session filters; `boardIds` may contain "none" for sessions without a board. */
export type SessionQuery = {
  teamIds?: string[];
  agentIds?: string[];
  boardIds?: string[];
  sort?: SessionSort;
  cursor?: string;
  limit?: number;
};
function sessionQuery(q: SessionQuery) {
  const params = new URLSearchParams();
  if (q.teamIds?.length) params.set("teamId", q.teamIds.join(","));
  if (q.agentIds?.length) params.set("agentId", q.agentIds.join(","));
  if (q.boardIds?.length) params.set("boardId", q.boardIds.join(","));
  if (q.sort) params.set("sort", q.sort);
  if (q.cursor) params.set("cursor", q.cursor);
  if (q.limit) params.set("limit", String(q.limit));
  const text = params.toString();
  return text ? `?${text}` : "";
}
/** Browser-loadable URL for an image generated in a managed conversation. */
export function managedMessageImageUrl(
  baseUrl: string,
  conversationId: string,
  messageId: string,
  imageId: string,
) {
  const base = baseUrl.replace(/\/$/, "").replace(/\/v[12]$/, "/v2");
  return `${base}/agent-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/images/${encodeURIComponent(imageId)}`;
}
export function managedMessageFileUrl(
  baseUrl: string,
  conversationId: string,
  messageId: string,
  fileId: string,
  preview = false,
) {
  const base = baseUrl.replace(/\/$/, "").replace(/\/v[12]$/, "/v2");
  return `${base}/agent-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/files/${encodeURIComponent(fileId)}${preview ? "/preview" : ""}`;
}
export function createManagedAgentApi(options: HttpOptions = {}) {
  const request = createTransport({
    ...options,
    baseUrl: (options.baseUrl ?? "/api/v1").replace(/\/v[12]\/?$/, "/v2"),
  });
  const write = <T>(
    path: string,
    body: unknown,
    key: string,
    version?: number,
    method = "POST",
  ) =>
    request<T>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "Idempotency-Key": key,
        ...(version === undefined ? {} : { "If-Match": `"${version}"` }),
      },
    });
  return {
    voice: {
      start: (sdp: string) => request<{ id: string; sdp: string }>("/voice/sessions", { method: "POST", body: JSON.stringify({ sdp }) }),
      events: (id: string, after: number) => request<{ events: import("./voice").VoiceEvent[]; cursor: number }>(`/voice/sessions/${encodeURIComponent(id)}/events?after=${after}`),
      result: (id: string, callId: string, content: string) => request<unknown>(`/voice/sessions/${encodeURIComponent(id)}/results`, { method: "POST", body: JSON.stringify({ callId, content }) }),
      context: (id: string, content: string) => request<unknown>(`/voice/sessions/${encodeURIComponent(id)}/context`, { method: "POST", body: JSON.stringify({ content }) }),
      stop: (id: string) => request<unknown>(`/voice/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
    config: (id: string) =>
      request<S["ConfigurationState"]>(
        `/agents/${encodeURIComponent(id)}/execution-config`,
      ),
    configure: (
      id: string,
      body: S["ExecutionConfiguration"],
      version: number,
      key: string,
    ) =>
      write<S["ConfigurationState"]>(
        `/agents/${encodeURIComponent(id)}/execution-config`,
        body,
        key,
        version,
        "PUT",
      ),
    send: (id: string, body: S["SendAgentRequest"], key: string) =>
      write<S["AgentRequest"]>(
        `/agents/${encodeURIComponent(id)}/requests`,
        body,
        key,
      ),
    conversations: (id: string, cursor?: string) =>
      request<S["ConversationPage"]>(
        `/agents/${encodeURIComponent(id)}/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
    sessions: (query: SessionQuery = {}) =>
      request<S["ConversationPage"]>(
        `/agent-conversations${sessionQuery(query)}`,
      ),
    conversation: (id: string) =>
      request<S["Conversation"]>(
        `/agent-conversations/${encodeURIComponent(id)}`,
      ),
    updateConversation: (
      id: string,
      body: S["PatchConversation"],
      version: number,
      key: string,
    ) =>
      write<S["Conversation"]>(
        `/agent-conversations/${encodeURIComponent(id)}`,
        body,
        key,
        version,
        "PATCH",
      ),
    requests: (id: string, cursor?: string) =>
      request<S["RequestPage"]>(
        `/agents/${encodeURIComponent(id)}/requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
    teamApprovals: (id: string, cursor?: string) =>
      request<S["TeamManagedApprovalPage"]>(
        `/teams/${encodeURIComponent(id)}/managed-approvals${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
    snapshot: (id: string) =>
      request<ManagedSnapshot>(`/agent-requests/${encodeURIComponent(id)}`),
    messages: (id: string, cursor?: string) =>
      request<S["MessagePage"]>(
        `/agent-conversations/${encodeURIComponent(id)}/messages${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
      ),
    recoverFiles: (
      conversationId: string,
      messageId: string,
      version: number,
      key: string,
    ) =>
      write<S["Message"]>(
        `/agent-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/recover-files`,
        undefined,
        key,
        version,
      ),
    cancel: (id: string, version: number, key: string) =>
      write<S["AgentRequest"]>(
        `/agent-requests/${id}/cancel`,
        undefined,
        key,
        version,
      ),
    reconcile: (id: string, version: number, key: string) =>
      write<S["AgentRequest"]>(
        `/agent-requests/${id}/reconcile`,
        undefined,
        key,
        version,
      ),
    decide: (
      id: string,
      version: number,
      decision: "accept" | "decline",
      key: string,
      expectedTeamId?: string,
    ) =>
      write<S["Approval"]>(
        `/agent-approvals/${id}/decision`,
        { decision, ...(expectedTeamId ? { expectedTeamId } : {}) },
        key,
        version,
      ),
  };
}
export type ManagedAgentApi = ReturnType<typeof createManagedAgentApi>;
