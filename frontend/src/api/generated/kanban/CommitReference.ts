// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type CommitReference = {
  repositoryKey: string;
  branch: import("./CommitBranch").CommitBranch;
  hash: string;
  /** @enum {unknown} */
  availability: "local" | "published" | "unknown";
  remoteVerifiedAt: string | null;
  commitUrl: string | null;
  repository: import("./WorkRepository").WorkRepository;
};
