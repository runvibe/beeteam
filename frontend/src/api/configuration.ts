import { message, t as tr } from "@/i18n";

import { v7 } from "uuid";
import type { Database } from "./seed";
import type { Patches, PatchResults, Status } from "./types";
import { ApiError } from "./types";
import { projectTask } from "./projections";
export function validateText(value: unknown, name = tr("errors.text")) {
  if (
    typeof value === "string" &&
    new TextEncoder().encode(value).length > 65536
  )
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.textTooLong", { name: name }),
    );
  if (Array.isArray(value)) value.forEach((item) => validateText(item, name));
}
function validName(name: string) {
  if (!name.trim() || [...name].length > 200)
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.nameMustContain1To200Characters"),
    );
}
export function patchRecord<K extends keyof Patches>(
  db: Database,
  resource: K,
  id: string,
  body: Patches[K],
  version: number,
): PatchResults[K] {
  if (resource === "tasks" && "statusId" in body)
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.statusCanOnlyBeChangedWhenRecordingAnExecutionSummary"),
    );
  if ("slug" in body)
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.slugIsReadOnly"),
    );
  const row = db[resource].find((r) => r.id === id && !r.deletedAt);
  if (!row)
    throw new ApiError(404, "not_found", message("errors.recordNotFound"));
  if (row.version !== version)
    throw new ApiError(
      412,
      "version_conflict",
      message("errors.thisRecordChangedReloadBeforeSavingAgain"),
    );
  if (row.archivedAt && (!("archived" in body) || body.archived !== false))
    throw new ApiError(
      409,
      "archived",
      message("errors.archivedRecordsAreReadOnly"),
    );
  if (resource === "tasks") {
    const patch = body as Patches["tasks"];
    if (patch.workScope !== undefined)
      throw new ApiError(
        501,
        "unavailable",
        message("errors.projectDiscoveryRequiresTheConnectedApi"),
      );
    if (
      patch.specification !== undefined &&
      typeof patch.specification !== "string"
    )
      throw new ApiError(
        400,
        "invalid_request",
        message("errors.specificationMustBeMarkdownText"),
      );
    if (
      (patch.progress !== undefined && !patch.currentSummary?.trim()) ||
      (patch.currentSummary !== undefined &&
        (!patch.currentSummary.trim() ||
          Array.from(patch.currentSummary).length > 200))
    )
      throw new ApiError(
        400,
        "invalid_request",
        message("errors.currentSummaryRequiredUpTo200Characters"),
      );
  }
  for (const [key, value] of Object.entries(body)) validateText(value, key);
  if ("name" in body && body.name !== undefined) validName(body.name);
  if ("image" in body && body.image && !body.image.url.startsWith("https://"))
    throw new ApiError(
      400,
      "invalid_request",
      message("errors.theImageMustUseHttps"),
    );
  if (
    "autonomyMode" in body &&
    ![
      "manual",
      "automatic",
      ...(resource === "boards" ? ["standard"] : []),
    ].includes(body.autonomyMode!)
  )
    throw new ApiError(400, "invalid_request", message("errors.invalidMode"));
  if (resource === "statuses") {
    const status = row as Status;
    const patch = body as Patches["statuses"];
    const siblings = db.statuses.filter(
      (s) => s.boardId === status.boardId && !s.deletedAt && !s.archivedAt,
    );
    if (
      patch.name &&
      siblings.some(
        (s) =>
          s.id !== id &&
          s.name.trim().toLowerCase() === patch.name!.trim().toLowerCase(),
      )
    )
      throw new ApiError(
        409,
        "duplicate_name",
        message("errors.aStatusWithThisNameAlreadyExists"),
      );
    if (
      (patch.archived ||
        (patch.isDone !== undefined && patch.isDone !== status.isDone)) &&
      db.tasks.some((t) => t.statusId === id && !t.deletedAt)
    )
      throw new ApiError(
        409,
        "status_in_use",
        message("errors.aStatusInUseCannotBeArchivedOrHaveIts"),
      );
    if (
      (patch.archived || patch.isDone) &&
      !siblings.some((s) => s.id !== id && !s.isDone)
    )
      throw new ApiError(
        409,
        "status_required",
        message("errors.keepAtLeastOneActiveStatusThatIsNotCompleted"),
      );
  }
  if (
    resource === "boards" &&
    "teamId" in body &&
    body.teamId &&
    body.teamId !== (row as PatchResults["boards"]).teamId
  ) {
    if (
      !db.teams.some(
        (t) => t.id === body.teamId && !t.deletedAt && !t.archivedAt,
      )
    )
      throw new ApiError(
        409,
        "invalid_team",
        message("errors.invalidManagingTeam"),
      );
    const board = row as PatchResults["boards"];
    board.lastManagementChange = {
      id: v7(),
      boardId: id,
      type: "board.management_changed",
      previousTeamId: board.teamId,
      teamId: body.teamId,
      actor: { actorKind: "human", actorId: null },
      occurredAt: new Date().toISOString(),
      deletedAt: null,
    };
  }
  const values = { ...body } as Record<string, unknown>;
  if ("archived" in values) {
    values.archivedAt = values.archived ? new Date().toISOString() : null;
    delete values.archived;
  }
  Object.assign(
    row,
    values,
    { version: version + 1 },
    resource === "statuses" ? {} : { updatedAt: new Date().toISOString() },
  );
  return structuredClone(
    resource === "tasks" ? projectTask(row as PatchResults["tasks"], db) : row,
  ) as PatchResults[K];
}
export function addStatus(
  db: Database,
  boardId: string,
  input: { name: string; isDone: boolean },
): Status {
  const board = db.boards.find((b) => b.id === boardId && !b.deletedAt);
  if (!board)
    throw new ApiError(404, "not_found", message("errors.boardNotFound"));
  if (board.archivedAt)
    throw new ApiError(409, "archived", message("errors.boardArchived"));
  validName(input.name);
  const existing = db.statuses.filter(
    (s) => s.boardId === boardId && !s.deletedAt && !s.archivedAt,
  );
  if (existing.length >= 50)
    throw new ApiError(
      409,
      "status_limit",
      message("errors.limitOf50ActiveStatuses"),
    );
  if (
    existing.some(
      (s) => s.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    )
  )
    throw new ApiError(
      409,
      "duplicate_name",
      message("errors.aStatusWithThisNameAlreadyExists"),
    );
  const status: Status = {
    id: v7(),
    boardId,
    name: input.name,
    isDone: input.isDone,
    position: existing.length,
    archivedAt: null,
    deletedAt: null,
    version: 1,
  };
  db.statuses.push(status);
  board.version++;
  return structuredClone(status);
}
export function orderStatuses(
  db: Database,
  boardId: string,
  ids: string[],
  version: number,
) {
  const board = db.boards.find((b) => b.id === boardId && !b.deletedAt);
  if (!board)
    throw new ApiError(404, "not_found", message("errors.boardNotFound"));
  if (board.version !== version)
    throw new ApiError(
      412,
      "version_conflict",
      message("errors.theBoardChangedReloadTheStatuses"),
    );
  if (board.archivedAt)
    throw new ApiError(409, "archived", message("errors.boardArchived"));
  const statuses = db.statuses.filter(
    (s) => s.boardId === boardId && !s.archivedAt && !s.deletedAt,
  );
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== statuses.length ||
    ids.some((id) => !statuses.some((s) => s.id === id))
  )
    throw new ApiError(
      400,
      "invalid_order",
      message("errors.includeEveryActiveStatusExactlyOnce"),
    );
  const items = ids.map((id, position) => {
    const status = statuses.find((s) => s.id === id)!;
    status.position = position;
    status.version++;
    return status;
  });
  board.version++;
  return structuredClone({ items, boardVersion: board.version });
}
