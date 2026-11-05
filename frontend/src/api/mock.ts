import { message } from "@/i18n";

import { patchRecord, addStatus, orderStatuses } from "./configuration";
import { projectTask, descendantIds } from "./projections";
import { ApiError } from "./types";
import { mockParticipants } from "./mock-participants";
import { mockOverview } from "./mock-overview";
import type { BeeApi, Resources, Filters, Page, Entities } from "./types";
import { makeSeed, type Database } from "./seed";
type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const matches = (value: unknown, filter?: string) =>
  !filter ||
  String(value ?? "")
    .toLocaleLowerCase()
    .includes(filter.toLocaleLowerCase());
export function paginate<T>(rows: T[], f: Filters = {}): Page<T> {
  const offset = f.offset ?? 0,
    limit = f.limit ?? 50;
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 2147483647 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.invalidPagination"),
    );
  const items = rows.slice(offset, offset + limit),
    hasMore = offset + items.length < rows.length;
  return {
    items,
    offset,
    limit,
    total: rows.length,
    hasMore,
    nextOffset: hasMore ? offset + items.length : null,
  };
}
export function createMockApi(
  options: { delay?: number; fail?: boolean; seed?: Database } = {},
): BeeApi {
  const db = clone(options.seed ?? makeSeed());
  const latestOwnSummary = (taskId: string, agentId: string) =>
    db.summaries
      .filter(
        (s) => s.taskId === taskId && s.actorId === agentId && !s.deletedAt,
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          b.id.localeCompare(a.id),
      )[0];
  const wait = async () => {
    await new Promise((r) => setTimeout(r, options.delay ?? 160));
    if (options.fail)
      throw new ApiError(
        503,
        "unavailable",
        message("errors.simulatedFailureTryAgain"),
      );
  };
  function filtered<K extends keyof Resources>(
    resource: K,
    scope: string,
    f: Filters = {},
  ): Resources[K][] {
    if (
      resource === "tasks" &&
      f.includeArchived !== undefined &&
      f.archived !== undefined
    )
      throw new ApiError(
        400,
        "invalid_request",
        message("errors.useArchivedOrIncludearchivedNotBoth"),
      );
    let source: unknown[] = db[resource];
    if (resource === "members")
      source = db.agents.flatMap((a) =>
        a.bindings.leaderTeamId === scope
          ? [
              {
                agentId: a.id,
                name: a.name,
                role: "leader",
                agentArchivedAt: a.archivedAt,
              },
            ]
          : a.bindings.collaboratorTeamId === scope
            ? [
                {
                  agentId: a.id,
                  name: a.name,
                  role: "collaborator",
                  agentArchivedAt: a.archivedAt,
                },
              ]
            : [],
      );
    if (resource === "activities")
      source = db.tasks
        .filter(
          (t) =>
            t.authorAgentId === scope ||
            t.executorAgentId === scope ||
            !!latestOwnSummary(t.id, scope),
        )
        .map((t) => ({
          taskId: t.id,
          boardId: t.boardId,
          authorAgentId: t.authorAgentId,
          parentId: t.parentId,
          title: t.title,
          statusId: t.statusId,
          executorAgentId: t.executorAgentId,
          isCurrentExecutor: t.executorAgentId === scope,
          lastWorkedAt: latestOwnSummary(t.id, scope)?.createdAt ?? null,
          taskUpdatedAt: t.updatedAt,
          latestOwnSummaryId: latestOwnSummary(t.id, scope)?.id ?? null,
          taskPath: `/api/v1/tasks/${t.id}`,
          summariesPath: `/api/v1/tasks/${t.id}/execution-summaries?actorId=${scope}`,
          archivedAt: t.archivedAt,
          deletedAt: t.deletedAt,
        }));
    let rows = (source as Row[]).filter(
      (r) => !r.deletedAt || (resource === "attachments" && f.includeRemoved),
    );
    if ((resource === "summaries" || resource === "timeline") && f.id)
      rows = rows.filter((row) => row.id === f.id);
    if (resource === "attachments") {
      rows = rows.filter(
        (row) =>
          matches(row.originalName, f.fileName) &&
          (!f.mediaType ||
            f.mediaType
              .split(",")
              .some(
                (mime) =>
                  String(row.mediaType).toLowerCase() ===
                  mime.trim().toLowerCase(),
              )),
      );
    }
    if (resource === "comments" && f.text)
      rows = rows.filter((row) => String(row.body).includes(f.text!));
    if (resource === "statuses" && !f.includeArchived)
      rows = rows.filter((r) => !r.archivedAt);
    if (resource === "tasks")
      rows = db.tasks
        .filter((t) => !t.deletedAt)
        .map((t) => projectTask(t, db)) as unknown as Row[];
    const scopeKey = ["boards", "agents", "teams"].includes(resource)
      ? null
      : ["tasks", "statuses"].includes(resource)
        ? "boardId"
        : resource === "chats"
          ? "agentId"
          : ["members", "activities"].includes(resource)
            ? null
            : "taskId";
    if (scopeKey && scope)
      rows = rows.filter((r) =>
        resource === "timeline" && f.includeChildren
          ? descendantIds(scope, db).has(String(r.taskId))
          : r[scopeKey] === scope,
      );
    rows = rows.filter(
      (r) =>
        matches(r.title, f.title) &&
        matches(r.name, f.name) &&
        matches(r.label, f.label),
    );
    for (const key of [
      "boardId",
      "statusId",
      "parentId",
      "executorAgentId",
      "authorAgentId",
      "actorId",
      "actorKind",
      "harness",
    ] as const)
      if (f[key]) rows = rows.filter((r) => r[key] === f[key]);
    if (f.teamId)
      rows = rows.filter((r) =>
        resource === "agents"
          ? Object.values(r.bindings as Row).includes(f.teamId)
          : r.teamId === f.teamId,
      );
    if (f.role)
      rows = rows.filter((r) =>
        resource === "agents"
          ? !!(r.bindings as Row)[`${f.role}TeamId`] &&
            (!f.teamId || (r.bindings as Row)[`${f.role}TeamId`] === f.teamId)
          : r.role === f.role,
      );
    if (f.rootOnly) rows = rows.filter((r) => r.parentId === null);
    if (f.blocked !== undefined)
      rows = rows.filter(
        (r) => (r.block as { blocked: boolean })?.blocked === f.blocked,
      );
    if (
      ["boards", "tasks", "agents", "teams", "chats", "activities"].includes(
        resource,
      )
    )
      rows = rows.filter(
        (r) =>
          (resource === "tasks" && f.includeArchived === true) ||
          Boolean(r.archivedAt) === (f.archived ?? false),
      );
    if (f.types)
      rows = rows.filter((r) => f.types!.split(",").includes(String(r.type)));
    if (f.relation === "authored")
      rows = rows.filter((r) => r.authorAgentId === scope);
    if (f.relation === "executing")
      rows = rows.filter((r) => r.isCurrentExecutor);
    if (f.relation === "worked") rows = rows.filter((r) => r.lastWorkedAt);
    for (const field of ["created", "updated"] as const) {
      const from = f[`${field}From`],
        before = f[`${field}Before`];
      if (from && before && from >= before)
        throw new ApiError(
          400,
          "invalid_request",
          message("errors.invalidDateRange"),
        );
      rows = rows.filter((r) => {
        const value = String(r[`${field}At`] ?? r.taskUpdatedAt ?? "");
        return (!from || value >= from) && (!before || value < before);
      });
    }
    const key =
      f.sortBy ??
      (resource === "statuses"
        ? "position"
        : resource === "timeline"
          ? "sequence"
          : resource === "members"
            ? "name"
            : resource === "activities"
              ? "taskUpdatedAt"
              : "createdAt");
    rows.sort((a, b) => {
      const av = a[key] ?? "",
        bv = b[key] ?? "";
      const result =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return (
        (result ||
          String(a.id ?? a.taskId ?? a.agentId).localeCompare(
            String(b.id ?? b.taskId ?? b.agentId),
          )) * (f.sortOrder === "desc" ? -1 : 1)
      );
    });
    if (resource === "plans")
      rows = rows.filter(
        (r) =>
          !rows.some(
            (other) =>
              other.planId === r.planId &&
              Number(other.revision) > Number(r.revision),
          ),
      );
    if (resource === "activities")
      rows = rows.map((r) => {
        const result = { ...r };
        delete result.archivedAt;
        delete result.deletedAt;
        return result;
      });
    return rows as unknown as Resources[K][];
  }
  const api: BeeApi = {
    info: async () => ({
      apiVersion: "demo",
      supportedContractVersions: ["v1"],
      capabilities: ["teams.role-icons"],
    }),
    async agentLatestActivity(agentId) {
      await api.get("agents", agentId);
      const event = db.timeline
        .filter((e) => {
          const task = db.tasks.find((t) => t.id === e.taskId && !t.deletedAt);
          return (
            e.actorKind === "agent" &&
            e.actorId === agentId &&
            !e.deletedAt &&
            task &&
            db.boards.some((b) => b.id === task.boardId && !b.deletedAt)
          );
        })
        .sort(
          (a, b) =>
            Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
            b.sequence - a.sequence ||
            b.id.localeCompare(a.id),
        )[0];
      if (!event) return { activity: null };
      const task = db.tasks.find((t) => t.id === event.taskId)!;
      const summary = db.summaries.find(
        (s) =>
          event.type === "execution.recorded" &&
          s.id === event.data.executionSummaryId &&
          s.taskId === task.id &&
          !s.deletedAt,
      );
      return {
        activity: {
          type: event.type,
          occurredAt: event.occurredAt,
          taskId: task.id,
          taskSlug: task.slug,
          taskTitle: task.title,
          eventId: event.id,
          summaryId: summary?.id ?? null,
        },
      };
    },
    async timelinePoints(taskId, pagination = {}, signal) {
      const page = await api.list(
        "timeline",
        taskId,
        { ...pagination, sortBy: "sequence", sortOrder: "asc" },
        signal,
      );
      return {
        ...page,
        items: page.items.map(({ id, taskId, type, occurredAt, sequence }) => ({
          id,
          taskId,
          type,
          occurredAt,
          sequence,
        })),
      };
    },
    async comment(taskId, commentId) {
      const row = db.comments.find(
        (row) =>
          row.taskId === taskId && row.id === commentId && !row.deletedAt,
      );
      if (!row)
        throw new ApiError(404, "not_found", message("errors.commentNotFound"));
      return structuredClone(row);
    },
    async openProject() {
      throw new ApiError(
        501,
        "local_action_unavailable",
        message("errors.openingLocalProjectsRequiresAConnectionToTheBeeTeam"),
      );
    },
    async executionIntervalUsage() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.intervalsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async executionIntervals() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.intervalsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async executionTrackingEvents() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.intervalsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async executionIntervalRevisions() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.intervalsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async usage() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.metricsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async usageDimensions() {
      throw new ApiError(
        501,
        "unavailable",
        message("errors.metricsAreOnlyAvailableWithTheConnectedApi"),
      );
    },
    async participants(taskId, pagination = {}) {
      await wait();
      return clone(paginate(mockParticipants(db, taskId), pagination));
    },
    async overview(taskId) {
      await wait();
      return clone(mockOverview(db, taskId));
    },
    async list<K extends keyof Resources>(
      resource: K,
      scope: string = "",
      f: Filters = {},
    ) {
      await wait();
      return clone(paginate(filtered(resource, scope, f), f));
    },
    async resolveSlug(resource, slug) {
      await wait();
      const row = db[resource].find((r) => r.slug === slug && !r.deletedAt);
      if (!row)
        throw new ApiError(404, "not_found", message("errors.recordNotFound"));
      return { id: row.id, slug: row.slug };
    },
    async get<K extends keyof Entities>(resource: K, id: string) {
      await wait();
      const row = db[resource].find((r) => r.id === id && !r.deletedAt);
      if (!row)
        throw new ApiError(404, "not_found", message("errors.recordNotFound"));
      return clone(
        resource === "tasks" ? projectTask(row as Entities["tasks"], db) : row,
      ) as Entities[K];
    },
    async board(id, f = {}) {
      await wait();
      const statuses = filtered("statuses", id, {
        archived: false,
        sortBy: "position",
      });
      return clone({
        boardId: id,
        columns: statuses.map((status) => {
          const page = paginate(
            filtered("tasks", id, {
              ...f,
              statusId: status.id,
              archived: false,
              sortBy: "position",
              sortOrder: "asc",
            }),
            { offset: 0, limit: f.limitPerColumn ?? 20 },
          );
          return {
            status,
            tasks: page.items,
            total: page.total,
            offset: page.offset,
            limit: page.limit,
            hasMore: page.hasMore,
            nextOffset: page.nextOffset,
          };
        }),
      });
    },
    async patch(resource, id, body, version) {
      await wait();
      return patchRecord(db, resource, id, body, version);
    },
    async createStatus(boardId, input) {
      await wait();
      return addStatus(db, boardId, input);
    },
    async reorderStatuses(boardId, ids, version) {
      await wait();
      return orderStatuses(db, boardId, ids, version);
    },
    async revisions(taskId, planId, f = {}) {
      await wait();
      return clone(
        paginate(
          db.plans
            .filter(
              (p) =>
                p.taskId === taskId &&
                p.planId === planId &&
                !p.deletedAt &&
                (!f.actorId || p.actorId === f.actorId) &&
                (!f.createdFrom ||
                  Date.parse(p.createdAt) >= Date.parse(f.createdFrom)) &&
                (!f.createdBefore ||
                  Date.parse(p.createdAt) < Date.parse(f.createdBefore)),
            )
            .sort(
              (a, b) =>
                ((f.sortBy === "createdAt"
                  ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
                  : a.revision - b.revision) || a.id.localeCompare(b.id)) *
                (f.sortOrder === "desc" ? -1 : 1),
            ),
          f,
        ),
      );
    },
    async image(agentId) {
      await wait();
      const agent = db.agents.find((a) => a.id === agentId && !a.deletedAt);
      if (agent?.image?.kind !== "upload" || agent.image.deletedAt)
        throw new ApiError(
          404,
          "not_found",
          message("errors.imageUnavailable"),
        );
      // Explicit one-pixel PNG fixture; no real file/network storage in this adapter.
      const bytes = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      );
      return new Blob([bytes], { type: "image/png" });
    },
    async download(taskId, attachmentId) {
      await wait();
      if (
        !db.attachments.some(
          (a) => a.taskId === taskId && a.id === attachmentId && !a.deletedAt,
        )
      )
        throw new ApiError(404, "not_found", message("errors.fileUnavailable"));
      return new Blob(
        [
          "Dados demonstrativos Bee Team.\nPontos de entrada: boards, tarefas e recursos de agentes.\n",
        ],
        { type: "text/plain" },
      );
    },
  };
  return api;
}
