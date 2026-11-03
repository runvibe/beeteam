import { v7 } from "uuid";
import type { Database } from "./seed";
import type { Patches, PatchResults, Status } from "./types";
import { ApiError } from "./types";
import { projectTask } from "./projections";
export function validateText(value: unknown, name = "Texto") {
  if (
    typeof value === "string" &&
    new TextEncoder().encode(value).length > 65536
  )
    throw new ApiError(400, "invalid_request", `${name} excede 64 KiB UTF-8.`);
  if (Array.isArray(value)) value.forEach((item) => validateText(item, name));
}
function validName(name: string) {
  if (!name.trim() || [...name].length > 200)
    throw new ApiError(
      400,
      "invalid_request",
      "Nome deve conter de 1 a 200 caracteres.",
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
      "Status só pode ser alterado ao registrar um resumo de execução.",
    );
  if ("slug" in body)
    throw new ApiError(400, "invalid_request", "Slug é somente leitura.");
  const row = db[resource].find((r) => r.id === id && !r.deletedAt);
  if (!row) throw new ApiError(404, "not_found", "Registro não encontrado.");
  if (row.version !== version)
    throw new ApiError(
      412,
      "version_conflict",
      "Este registro mudou. Recarregue antes de salvar novamente.",
    );
  if (row.archivedAt && (!("archived" in body) || body.archived !== false))
    throw new ApiError(
      409,
      "archived",
      "Registro arquivado é somente leitura.",
    );
  if (resource === "tasks") {
    const patch = body as Patches["tasks"];
    if (patch.workScope !== undefined)
      throw new ApiError(
        501,
        "unavailable",
        "A descoberta de projetos requer a API conectada.",
      );
    if (
      patch.specification !== undefined &&
      typeof patch.specification !== "string"
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Especificação deve ser texto Markdown.",
      );
    if (
      (patch.progress !== undefined && !patch.currentSummary?.trim()) ||
      (patch.currentSummary !== undefined &&
        (!patch.currentSummary.trim() ||
          new TextEncoder().encode(patch.currentSummary).length > 16384))
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Resumo atual obrigatorio, nao vazio e com ate 16384 bytes UTF-8.",
      );
  }
  for (const [key, value] of Object.entries(body)) validateText(value, key);
  if ("name" in body && body.name !== undefined) validName(body.name);
  if ("image" in body && body.image && !body.image.url.startsWith("https://"))
    throw new ApiError(400, "invalid_request", "A imagem deve usar HTTPS.");
  if (
    "autonomyMode" in body &&
    ![
      "manual",
      "automatic",
      ...(resource === "boards" ? ["standard"] : []),
    ].includes(body.autonomyMode!)
  )
    throw new ApiError(400, "invalid_request", "Modo inválido.");
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
        "Já existe um status com esse nome.",
      );
    if (
      (patch.archived ||
        (patch.isDone !== undefined && patch.isDone !== status.isDone)) &&
      db.tasks.some((t) => t.statusId === id && !t.deletedAt)
    )
      throw new ApiError(
        409,
        "status_in_use",
        "Status em uso não pode ser arquivado nem mudar a conclusão.",
      );
    if (
      (patch.archived || patch.isDone) &&
      !siblings.some((s) => s.id !== id && !s.isDone)
    )
      throw new ApiError(
        409,
        "status_required",
        "Mantenha ao menos um status ativo não final.",
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
      throw new ApiError(409, "invalid_team", "Time gestor inválido.");
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
  if (!board) throw new ApiError(404, "not_found", "Board não encontrado.");
  if (board.archivedAt) throw new ApiError(409, "archived", "Board arquivado.");
  validName(input.name);
  const existing = db.statuses.filter(
    (s) => s.boardId === boardId && !s.deletedAt && !s.archivedAt,
  );
  if (existing.length >= 50)
    throw new ApiError(409, "status_limit", "Limite de 50 status ativos.");
  if (
    existing.some(
      (s) => s.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    )
  )
    throw new ApiError(
      409,
      "duplicate_name",
      "Já existe um status com esse nome.",
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
  if (!board) throw new ApiError(404, "not_found", "Board não encontrado.");
  if (board.version !== version)
    throw new ApiError(
      412,
      "version_conflict",
      "O board mudou. Recarregue os status.",
    );
  if (board.archivedAt) throw new ApiError(409, "archived", "Board arquivado.");
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
      "Inclua todos os status ativos uma única vez.",
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
