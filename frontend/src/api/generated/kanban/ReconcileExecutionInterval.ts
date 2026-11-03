// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ReconcileExecutionInterval = {
  reason: string;
  invalidate?: boolean;
  startEvidence?: import("./IntervalEvidenceReference").IntervalEvidenceReference[];
  endEvidence?: import("./IntervalEvidenceReference").IntervalEvidenceReference[];
};
