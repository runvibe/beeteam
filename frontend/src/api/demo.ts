import { createMockApi } from "./mock";
import { makeSeed, uuid } from "./seed";
import { ApiError, type BeeApi } from "./types";
import { message, t } from "@/i18n";

/** Ephemeral read-only sample data. It never constructs an HTTP client. */
export function createDemoApi(): BeeApi {
  const seed = makeSeed();
  const template = seed.boards[0];
  for (const [index, name] of [
    t("common.demoContentBoard"),
    t("common.demoQualityBoard"),
  ].entries()) {
    const boardId = uuid(12 + index);
    seed.boards.push({ ...template, id: boardId, name });
    const statuses = seed.statuses.filter(
      (status) => status.boardId === template.id,
    );
    const mapped = new Map(
      statuses.map((status, slot) => [
        status.id,
        uuid(600 + index * 10 + slot),
      ]),
    );
    seed.statuses.push(
      ...statuses.map((status) => ({
        ...status,
        id: mapped.get(status.id)!,
        boardId,
      })),
    );
    seed.tasks.push(
      ...seed.tasks
        .filter((task) => task.boardId === template.id && !task.parentId)
        .slice(0, 3)
        .map((task, slot) => {
          const id = uuid(700 + index * 10 + slot);
          return {
            ...task,
            id,
            slug: `demo-${index}-${slot}`,
            boardId,
            statusId: mapped.get(task.statusId)!,
            parentId: null,
            title: [
          t("common.demoPrepareTask"),
          t("common.demoReviewTask"),
          t("common.demoLearnTask"),
            ][slot],
            executionContext: {
              ...task.executionContext,
              rootTaskId: id,
              originBoardId: boardId,
            },
          };
        }),
    );
  }
  const api = createMockApi({ seed, delay: 0 });
  const readonly = async (): Promise<never> => {
    throw new ApiError(409, "demo_readonly", message("common.demoReadonly"));
  };
  return {
    ...api,
    patch: readonly,
    createStatus: readonly,
    reorderStatuses: readonly,
    openProject: readonly,
  };
}
