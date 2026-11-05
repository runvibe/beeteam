import { useRouteEntity } from "@/routing/entity-route";
import { useApi } from "@/api/context";
import { useQueryClient } from "@tanstack/react-query";
import { destination, goBack, navigate, useLocation } from "@/routing/location";
export type Area = "boards" | "agents" | "teams" | "home";
/** Navigation is derived from URL, never a parallel Zustand state. */
export function useUi<T = ReturnType<typeof state>>(
  selector?: (value: ReturnType<typeof state>) => T,
): T {
  const url = useLocation();
  const resolved = useRouteEntity();
  const api = useApi(),
    client = useQueryClient();
  const value = state(url);
  if (resolved.active && !resolved.data) {
    value.agentId = null;
    value.teamId = null;
    value.taskId = null;
  }
  if (resolved.data) {
    if (value.agentId) value.agentId = resolved.data.id;
    if (value.teamId) value.teamId = resolved.data.id;
    if (value.taskId) value.taskId = resolved.data.id;
  }
  const open = async (
    resource: "agents" | "teams" | "tasks",
    id: string | null,
  ) => {
    if (!id) {
      goBack(resource === "tasks" ? "/boards" : `/${resource}`);
      return;
    }
    const origin = location.pathname + location.search;
    try {
      const entity = await client.ensureQueryData({
        queryKey: [resource, id],
        queryFn: () => api.get(resource, id),
      });
      if (location.pathname + location.search === origin)
        navigate(destination(`/${resource}/${entity.slug}`));
    } catch {
      if (location.pathname + location.search === origin)
        navigate(destination(`/${resource}/${id}`));
    }
  };
  value.openAgent = (id) => {
    void open("agents", id);
  };
  value.openTeam = (id) => {
    void open("teams", id);
  };
  value.openTask = (id) => {
    void open("tasks", id);
  };
  return selector ? selector(value) : (value as T);
}
function state(url: string) {
  const [path] = url.split("?");
  const [, resource, id] = path.split("/");
  return {
    area: (resource === "home"
      ? "home"
      : resource === "agents"
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
