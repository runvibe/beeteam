// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type UsageObservation = {
  source: string;
  harness: string;
  surface: string;
  harnessVersion: string | null;
  sessionId: string;
  epoch: string;
  evidenceId: string;
  previousEvidenceId: string | null;
  actor:
    | {
        /** @constant */
        kind: "agent";
        /** Format: uuid */
        id: string;
      }
    | {
        /** @constant */
        kind: "human";
        id: null;
      };
  /** @enum {string} */
  actorRole: "leader" | "worker" | "human" | "unknown";
  provider: string | null;
  modelId: string | null;
  /** @enum {string} */
  scope: "request" | "session" | "session_tree";
  /** @enum {string} */
  reportKind: "cumulative_snapshot" | "period_delta" | "unavailable";
  /** @enum {string} */
  quality: "measured" | "estimated" | "unavailable";
  /** @enum {string} */
  attribution: "exact" | "shared" | "unallocated";
  /** Format: date-time */
  observedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  inputTokens: string | null;
  outputTokens: string | null;
  cachedInputTokens: string | null;
  reasoningOutputTokens: string | null;
  discovery: {
    reason: string;
    attempts: string[];
  } | null;
  /** @description Explicit inclusive input+output cumulative total. Required for new summaries; optional in legacy evidence. Never add cache/reasoning twice or sum successive snapshots. */
  totalTokens?: string | null;
};
