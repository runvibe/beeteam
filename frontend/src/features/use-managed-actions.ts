import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/types";
import { t } from "@/i18n";

type PendingAction = {
  agentId: string;
  signature: string;
  key: string;
  run: (key: string) => Promise<unknown>;
  running: boolean;
};

class ManagedActionRegistry {
  private actions: PendingAction[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = () => this.actions;

  private update(actions: PendingAction[]) {
    this.actions = actions;
    this.listeners.forEach((listener) => listener());
  }

  async run(
    agentId: string,
    signature: string,
    run: (key: string) => Promise<unknown>,
  ) {
    let action = this.actions.find((item) => item.agentId === agentId);
    if (action && (action.signature !== signature || action.running)) {
      throw new Error(t("managed.retryAction"));
    }
    action ??= {
      agentId,
      signature,
      key: crypto.randomUUID(),
      run,
      running: false,
    };
    const active = { ...action, running: true };
    this.update([
      ...this.actions.filter((item) => item.agentId !== agentId),
      active,
    ]);
    try {
      const result = await active.run(active.key);
      this.update(this.actions.filter((item) => item !== active));
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408
      ) {
        this.update(this.actions.filter((item) => item !== active));
      } else {
        this.update(
          this.actions.map((item) =>
            item === active ? { ...active, running: false } : item,
          ),
        );
      }
      throw error;
    }
  }
}

const registries = new WeakMap<QueryClient, ManagedActionRegistry>();

export function useManagedActions() {
  const client = useQueryClient();
  let registry = registries.get(client);
  if (!registry) {
    registry = new ManagedActionRegistry();
    registries.set(client, registry);
  }
  const actions = useSyncExternalStore(
    registry.subscribe,
    registry.snapshot,
    registry.snapshot,
  );
  return {
    actions,
    run: async (
      agentId: string,
      signature: string,
      run: (key: string) => Promise<unknown>,
    ) => {
      try {
        return await registry.run(agentId, signature, run);
      } finally {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["managed-config", agentId] }),
          client.invalidateQueries({ queryKey: ["managed-requests", agentId] }),
          client.invalidateQueries({ queryKey: ["managed-snapshot"] }),
          client.invalidateQueries({ queryKey: ["team-managed-approvals"] }),
          client.invalidateQueries({
            queryKey: ["team-managed-retry-members"],
          }),
        ]);
      }
    },
  };
}
