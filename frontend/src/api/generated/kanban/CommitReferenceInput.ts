// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type CommitReferenceInput = {
  repositoryKey: string;
  branch: import("./CommitBranch").CommitBranch;
  hash: string;
  /** @enum {unknown} */
  availability: "local" | "published" | "unknown";
  remoteVerifiedAt: string | null;
  commitUrl: string | null;
};
