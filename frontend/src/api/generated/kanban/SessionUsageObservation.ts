// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type SessionUsageObservation =
  import("./UsageObservation").UsageObservation & {
    totalTokens: string;
    inputTokens?: string;
    outputTokens?: string;
    modelId?: string;
    actor?: {
      /** @constant */
      kind: "agent";
      /** Format: uuid */
      id: string;
    };
    /** @constant */
    reportKind?: "cumulative_snapshot";
    /** @constant */
    quality?: "measured";
    /** @enum {unknown} */
    scope?: "session" | "session_tree";
  };
