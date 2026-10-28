// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type BoardManagementChange = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  boardId: string;
  /** @constant */
  type: "board.management_changed";
  /** Format: uuid */
  previousTeamId: string;
  /** Format: uuid */
  teamId: string;
  actor: import("./DeclaredActor").DeclaredActor;
  /** Format: date-time */
  occurredAt: string;
  /** Format: date-time */
  deletedAt: string | null;
};
