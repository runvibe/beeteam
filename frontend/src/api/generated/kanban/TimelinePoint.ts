// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TimelinePoint = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  taskId: string;
  type: import("./EventType").EventType;
  /** Format: date-time */
  occurredAt: string;
  sequence: number;
};
