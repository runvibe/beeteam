import type { BeeApi, Resources, Filters } from "./types";
import type { TaskOverview } from "./generated/kanban/TaskOverview";
import { ApiError } from "./types";
import { createTransport, type HttpOptions } from "./http-transport";
const segment = encodeURIComponent;
function query(filters: Filters & { kind?: "model" | "harness"; summaryId?: string } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
function collection(resource: keyof Resources, scope: string) {
  switch (resource) {
    case "boards":
    case "agents":
    case "teams":
      return `/${resource}`;
    case "tasks":
      return scope ? `/boards/${segment(scope)}/tasks` : "/tasks";
    case "statuses":
      return `/boards/${segment(scope)}/statuses`;
    case "members":
      return `/teams/${segment(scope)}/members`;
    case "activities":
      return `/agents/${segment(scope)}/activities`;
    case "chats":
      return `/agents/${segment(scope)}/chat-references`;
    case "summaries":
      return `/tasks/${segment(scope)}/execution-summaries`;
    default:
      return `/tasks/${segment(scope)}/${resource}`;
  }
}
export function createHttpApi(options: HttpOptions = {}): BeeApi {
  const request = createTransport(options);
  return {
    openProject: (taskId, projectKey, application) =>
      request(
        `/tasks/${segment(taskId)}/projects/${segment(projectKey)}/open`,
        {
          method: "POST",
          body: JSON.stringify({ application }),
          headers: { "X-Bee-Local-Action": "open-project" },
        },
      ),
    executionIntervalUsage: (taskId, signal) =>
      request(`/tasks/${segment(taskId)}/execution-interval-usage`, { signal }),
    executionIntervals: (taskId, pagination = {}, signal) =>
      request(
        `/tasks/${segment(taskId)}/execution-intervals` + query(pagination),
        { signal },
      ),
    executionTrackingEvents: (taskId, pagination = {}, signal) =>
      request(
        `/tasks/${segment(taskId)}/execution-tracking-events` +
          query(pagination),
        { signal },
      ),
    executionIntervalRevisions: (taskId, intervalId, pagination = {}, signal) =>
      request(
        `/tasks/${segment(taskId)}/execution-intervals/${segment(intervalId)}/revisions` +
          query(pagination),
        { signal },
      ),
    usage: (taskId, pagination = {}, signal) =>
      request(`/tasks/${segment(taskId)}/usage` + query(pagination), {
        signal,
      }),
    usageDimensions: (taskId, kind, pagination = {}, signal) =>
      request(
        `/tasks/${segment(taskId)}/usage/dimensions` +
          query({ ...pagination, kind }),
        { signal },
      ),
    overview: (taskId, signal) =>
      request<TaskOverview>(`/tasks/${segment(taskId)}/overview`, { signal }),
    participants: (taskId, pagination = {}, signal) =>
      request(`/tasks/${segment(taskId)}/participants` + query(pagination), {
        signal,
      }),
    resolveSlug: (resource, slug) =>
      request(`/${resource}/by-slug/${segment(slug)}`),
    list: (resource, scope = "", filters = {}, signal) =>
      request(collection(resource, scope) + query(filters), { signal }),
    get: (resource, id) => request(`/${resource}/${segment(id)}`),
    board: (id, filters = {}) =>
      request(`/boards/${segment(id)}/view` + query(filters)),
    patch: (resource, id, body, version, scope) => {
      if (resource === "statuses" && !scope)
        throw new ApiError(
          400,
          "invalid_request",
          "Board do status não informado.",
        );
      const path =
        resource === "statuses"
          ? `/boards/${segment(scope!)}/statuses/${segment(id)}`
          : `/${resource}/${segment(id)}`;
      return request(path, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "If-Match": `"${version}"` },
      });
    },
    revisions: (taskId, planId, filters = {}, signal) =>
      request(
        `/tasks/${segment(taskId)}/plans/${segment(planId)}/revisions` +
          query(filters),
        { signal },
      ),
    resume: (id) => request(`/agents/${segment(id)}/resumption-context`),
    createStatus: (boardId, input, key = crypto.randomUUID()) =>
      request(`/boards/${segment(boardId)}/statuses`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Idempotency-Key": key },
      }),
    reorderStatuses: (boardId, statusIds, version) =>
      request(`/boards/${segment(boardId)}/status-order`, {
        method: "PUT",
        body: JSON.stringify({ statusIds }),
        headers: { "If-Match": `"${version}"` },
      }),
    download: (taskId, id) =>
      request(
        `/tasks/${segment(taskId)}/attachments/${segment(id)}/content`,
        {},
        true,
      ),
    image: (id) => request(`/agents/${segment(id)}/image/content`, {}, true),
  };
}
