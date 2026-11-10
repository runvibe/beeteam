import { createTransport, type HttpOptions } from "./http-transport";
import type { components } from "./generated/managed-agents";
type S = components["schemas"];
export type ManagedSnapshot = S["RequestSnapshot"];
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
    requests: (id: string, cursor?: string) =>
      request<S["RequestPage"]>(`/agents/${encodeURIComponent(id)}/requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
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
