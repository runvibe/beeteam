// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskWorkScope = {
  /** @enum {unknown} */
  status: "identified" | "to_identify" | "not_applicable";
  projects: import("./WorkProject").WorkProject[];
  repositories: import("./WorkRepository").WorkRepository[];
};
