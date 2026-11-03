// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type WorkRepository = {
  key: string;
  name: string;
  remoteUrl: string | null;
  webUrl: string | null;
  /** @enum {unknown} */
  provider: "github" | "gitlab" | "other";
  projectKeys: string[];
};
