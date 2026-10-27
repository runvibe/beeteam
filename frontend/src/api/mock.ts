import { patchRecord, addStatus, orderStatuses } from "./configuration";
import { projectTask, descendantIds } from "./projections";
import { ApiError } from "./types";
import type { BeeApi, Resources, Filters, Page, Entities } from "./types";
import { makeSeed } from "./seed";
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
    throw new ApiError(400, "invalid_request", "Paginação inválida.");
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
  options: { delay?: number; fail?: boolean } = {},
): BeeApi {
  const db = makeSeed();
  const wait = async () => {
    await new Promise((r) => setTimeout(r, options.delay ?? 160));
    if (options.fail)
      throw new ApiError(
        503,
        "unavailable",
        "Falha simulada. Tente novamente.",
      );
  };
  function filtered<K extends keyof Resources>(
    resource: K,
    scope: string,
    f: Filters = {},
  ): Resources[K][] {
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
            db.summaries.some((s) => s.taskId === t.id && s.actorId === scope),
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
          lastWorkedAt:
            db.summaries.find((s) => s.taskId === t.id && s.actorId === scope)
              ?.createdAt ?? null,
          taskUpdatedAt: t.updatedAt,
          latestOwnSummaryId:
            db.summaries.find((s) => s.taskId === t.id && s.actorId === scope)
              ?.id ?? null,
          taskPath: `/api/v1/tasks/${t.id}`,
          summariesPath: `/api/v1/tasks/${t.id}/execution-summaries?actorId=${scope}`,
          archivedAt: t.archivedAt,
          deletedAt: t.deletedAt,
        }));
    let rows = (source as Row[]).filter(
      (r) => !r.deletedAt || (resource === "attachments" && f.includeRemoved),
    );
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
        (r) => Boolean(r.archivedAt) === (f.archived ?? false),
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
          "Intervalo de datas inválido.",
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
    async list<K extends keyof Resources>(
      resource: K,
      scope: string = "",
      f: Filters = {},
    ) {
      await wait();
      return clone(paginate(filtered(resource, scope, f), f));
    },
    async get<K extends keyof Entities>(resource: K, id: string) {
      await wait();
      const row = db[resource].find((r) => r.id === id && !r.deletedAt);
      if (!row)
        throw new ApiError(404, "not_found", "Registro não encontrado.");
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
              rootOnly: true,
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
              (p) => p.taskId === taskId && p.planId === planId && !p.deletedAt,
            )
            .sort((a, b) => b.revision - a.revision),
          f,
        ),
      );
    },
    async resume(agentId) {
      const agent = await api.get("agents", agentId);
      return {
        agent,
        teamContexts: db.teams
          .filter((t) => Object.values(agent.bindings).includes(t.id))
          .map((t) => ({
            teamId: t.id,
            role:
              agent.bindings.leaderTeamId === t.id
                ? ("leader" as const)
                : ("collaborator" as const),
            name: t.name,
            purpose: t.purpose,
            context: t.context,
          })),
        activityIndexPath: `/api/v1/agents/${agentId}/activities`,
        chatReferencesPath: `/api/v1/agents/${agentId}/chat-references`,
        taskIds: [],
        generatedAt: new Date().toISOString(),
        notice:
          "Contexto demonstrativo. Não inicia chats nem confirma atividade ao vivo.",
      };
    },
    async download(taskId, attachmentId) {
      await wait();
      if (
        !db.attachments.some(
          (a) => a.taskId === taskId && a.id === attachmentId && !a.deletedAt,
        )
      )
        throw new ApiError(404, "not_found", "Arquivo não disponível.");
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
