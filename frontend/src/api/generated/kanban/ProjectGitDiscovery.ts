// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ProjectGitDiscovery = {
  /** @enum {unknown} */
  status: "detected" | "not_git" | "unavailable";
  /** @enum {unknown} */
  reason:
    | null
    | "path_unavailable"
    | "git_unavailable"
    | "timeout"
    | "output_limit"
    | "inspection_failed";
  /** Format: date-time */
  checkedAt: string;
  checkoutRoot: string | null;
  gitDirectory: string | null;
  commonDirectory: string | null;
  isWorktree: boolean | null;
  branch: import("./CommitBranch").CommitBranch | null;
  headHash: string | null;
  repositoryKey: string | null;
  remotes: {
    name: string;
    url: string | null;
  }[];
};
