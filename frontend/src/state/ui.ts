import { destination, goBack, navigate, useLocation } from "@/routing/location";
export type Area = "boards" | "agents" | "teams";
/** Navigation is derived from URL, never a parallel Zustand state. */
export function useUi<T = ReturnType<typeof state>>(
  selector?: (value: ReturnType<typeof state>) => T,
): T {
  const value = state(useLocation());
  return selector ? selector(value) : (value as T);
}
function state(url: string) {
  const [path] = url.split("?");
  const [, resource, id] = path.split("/");
  return {
    area: (resource === "agents"
      ? "agents"
      : resource === "teams"
        ? "teams"
        : "boards") as Area,
    boardId: resource === "boards" ? id || null : null,
    taskId: resource === "tasks" ? id || null : null,
    agentId: resource === "agents" ? id || null : null,
    teamId: resource === "teams" ? id || null : null,
    setArea: (area: Area) => navigate(`/${area}`),
    openBoard: (id: string) => navigate(destination(`/boards/${id}`)),
    openTask: (id: string | null) =>
      id ? navigate(destination(`/tasks/${id}`)) : goBack(),
    openAgent: (id: string | null) =>
      id ? navigate(destination(`/agents/${id}`)) : goBack("/agents"),
    openTeam: (id: string | null) =>
      id ? navigate(destination(`/teams/${id}`)) : goBack("/teams"),
  };
}
