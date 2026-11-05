// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type LinkTaskToParent = {
  /** Format: uuid */
  parentId: string;
  parentVersion: number;
  /** @description Required only when the task already has a parent, including unchanged-parent requests. */
  previousParentVersion?: number;
  coordinationContext: import("./CoordinationContext").CoordinationContext;
};
