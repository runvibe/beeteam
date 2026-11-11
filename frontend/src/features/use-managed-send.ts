import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import { t } from "@/i18n";
import { isDefinitiveManagedFailure } from "./managed-idempotency";

type Schemas = components["schemas"];
type SendContext = {
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
    agentId: string,
    api: ManagedAgentApi,
    body: Schemas["SendAgentRequest"],
    context: SendContext,
  ) {
    const previous = this.get(agentId);
    if (previous && previous.state !== "uncertain")
      throw new Error(t("managed.retryAction"));
    const active: PendingSend = {
      key: previous?.key ?? crypto.randomUUID(),
      body: previous?.body ?? body,
      context: previous?.context ?? context,
      state: "running",
    };
    this.update(agentId, active);
    try {
      const request = await api.send(agentId, active.body, active.key);
      this.update(agentId, { ...active, state: "completed", request });
    } catch (error) {
      this.update(
        agentId,
        isDefinitiveManagedFailure(error, !!previous)
          ? { ...active, state: "rejected", error }
          : { ...active, state: "uncertain" },
      );
      throw error;
    }
  }
}

const registries = new WeakMap<QueryClient, ManagedSendRegistry>();

export function useManagedSend(agentId: string, api: ManagedAgentApi) {
  const client = useQueryClient();
  let registry = registries.get(client);
  if (!registry) {
    registry = new ManagedSendRegistry();
    registries.set(client, registry);
  }
  const current = registry;
  const snapshot = useCallback(() => current.get(agentId), [current, agentId]);
  const pending = useSyncExternalStore(current.subscribe, snapshot, snapshot);
  const acknowledge = useCallback(
    (key: string) => current.acknowledge(agentId, key),
    [current, agentId],
  );
  const send = useCallback(
    (body: Schemas["SendAgentRequest"], context: SendContext) =>
      current.send(agentId, api, body, context),
    [current, agentId, api],
  );
  return {
    pending,
    send,
    acknowledge,
  };
}
