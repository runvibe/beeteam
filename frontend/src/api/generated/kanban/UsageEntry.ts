// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type UsageEntry = {
  /** Format: uuid */
  id: string;
  /** Format: date-time */
  reportedAt: string;
  reportingActor: import("./DeclaredActor").DeclaredActor;
  reportRevision: number;
  observation: import("./UsageObservation").UsageObservation;
  evidenceKey: string;
  /** Format: uuid */
  canonicalSummaryId: string;
  delta: import("./UsageDelta").UsageDelta | null;
  counted: boolean;
  /** @enum {string} */
  coverageReason:
    | "baseline_or_unavailable"
    | "duplicate_reference"
    | "attributed"
    | "shared_or_unallocated";
};
