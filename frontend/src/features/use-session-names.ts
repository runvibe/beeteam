import { useQueries } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { ManagedConversation } from "@/api/managed-agents";
import { ApiError } from "@/api/types";
import { t } from "@/i18n";
import type { SessionNames } from "./session-grouping";

type Resource = "teams" | "boards" | "agents";
type Named = { id: string; name: string };
type Lists = Record<Resource, Named[] | undefined>;
type Result = SessionNames & {
  error: unknown;
  isFetching: boolean;
  retry: () => Promise<unknown[]>;
};

export function useSessionNames(
  sessions: ManagedConversation[],
  lists: Lists,
): Result {
  const api = useApi();
  const names = new Map<string, string>();
  const missing = new Map<string, { resource: Resource; id: string }>();
  const key = (resource: Resource, id: string) => `${resource}:${id}`;
  for (const resource of ["teams", "boards", "agents"] as const) {
    for (const item of lists[resource] ?? []) {
      names.set(key(resource, item.id), item.name);
    }
  }
  for (const session of sessions) {
    const references: [Resource, string | null][] = [
      ["teams", session.teamId],
      ["boards", session.boardId],
      ["agents", session.agentId],
    ];
    for (const [resource, id] of references) {
      if (!id || !lists[resource] || names.has(key(resource, id))) continue;
      missing.set(key(resource, id), { resource, id });
    }
  }
  const entries = [...missing.values()];
  const details = useQueries({
    queries: entries.map(({ resource, id }) => ({
      queryKey: [resource, id],
      queryFn: () => api.get(resource, id),
    })),
  });
  details.forEach((detail, index) => {
    if (detail.data) {
      const { resource, id } = entries[index];
      names.set(key(resource, id), detail.data.name);
    }
  });
  const find = (resource: Resource, id: string) =>
    names.get(key(resource, id)) ?? t("sessions.unknown");
  const failed = details.filter(
    (detail) =>
      detail.isError &&
      !(detail.error instanceof ApiError && detail.error.status === 404),
  );
  return {
    team: (id) => find("teams", id),
    agent: (id) => find("agents", id),
    board: (id) => (id ? find("boards", id) : t("sessions.noBoard")),
    error: failed[0]?.error ?? null,
    isFetching: failed.some((detail) => detail.isFetching),
    retry: () => Promise.all(failed.map((detail) => detail.refetch())),
  };
}
