import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { t } from "@/i18n";
import { isDefinitiveManagedFailure } from "./managed-idempotency";

type Schemas = components["schemas"];
type SendContext = {
  source?: "voice";
  resetGeneration?: number;
  teamId: string | undefined;
  conversation: string;
  externalConversation: string | null | undefined;
};
type SendIdentity = {
  key: string;
  body: Schemas["SendAgentRequest"];
  context: SendContext;
};
type PendingSend = SendIdentity &
  (
    | { state: "running" }
    | { state: "uncertain" }
    | { state: "completed"; request: Schemas["AgentRequest"] }
    | { state: "rejected"; error: unknown }
  );

class ManagedSendRegistry {
  private readonly client: QueryClient;
  constructor(client: QueryClient) { this.client = client; }

  private sends = new Map<string, PendingSend>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(agentId: string) {
    return this.sends.get(agentId) ?? null;
  }

  private update(agentId: string, value: PendingSend | null) {
    if (value) this.sends.set(agentId, value);
    else this.sends.delete(agentId);
    this.listeners.forEach((listener) => listener());
  }

  acknowledge(agentId: string, key: string) {
    const pending = this.get(agentId);
    if (
      pending?.key !== key ||
      (pending.state !== "completed" && pending.state !== "rejected")
    )
      return false;
    this.update(agentId, null);
    return true;
  }

  async send(
    scope: string,
    agentId: string,
    api: ManagedAgentApi,
    body: Schemas["SendAgentRequest"],
    context: SendContext,
  ) {
    const previous = this.get(scope);
    if (previous && previous.state !== "uncertain")
      throw new Error(t("managed.retryAction"));
    const active: PendingSend = {
      key: previous?.key ?? crypto.randomUUID(),
      body: previous?.body ?? body,
      context: previous?.context ?? context,
      state: "running",
    };
    this.update(scope, active);
    try {
      const request = await api.send(agentId, active.body, active.key);
      this.update(scope, { ...active, state: "completed", request });
      void this.client.invalidateQueries({ queryKey: ["managed-sessions"] });
      void this.client.invalidateQueries({ queryKey: ["managed-conversations", agentId] });
      void this.client.invalidateQueries({ queryKey: ["managed-requests", agentId] });
      return request;
    } catch (error) {
      this.update(
        scope,
        isDefinitiveManagedFailure(error, !!previous)
          ? { ...active, state: "rejected", error }
          : { ...active, state: "uncertain" },
      );
      throw error;
    }
  }
}

const registries = new WeakMap<QueryClient, ManagedSendRegistry>();

export function useManagedSend(agentId: string, api: ManagedAgentApi, selectionScope: string) {
  const client = useQueryClient();
  let registry = registries.get(client);
  if (!registry) {
    registry = new ManagedSendRegistry(client);
    registries.set(client, registry);
  }
  const current = registry;
  const sendScope = `${agentId}:${selectionScope}`;
  const snapshot = useCallback(() => current.get(sendScope), [current, sendScope]);
  const pending = useSyncExternalStore(current.subscribe, snapshot, snapshot);
  const acknowledge = useCallback(
    (key: string) => current.acknowledge(sendScope, key),
    [current, sendScope],
  );
  const send = useCallback(
    (body: Schemas["SendAgentRequest"], context: SendContext) =>
      current.send(sendScope, agentId, api, body, context),
    [current, sendScope, agentId, api],
  );
  return {
    pending,
    send,
    acknowledge,
  };
}
