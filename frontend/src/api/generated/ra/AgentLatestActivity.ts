// Generated from contracts/ra-openapi.yaml. Do not edit.
export type AgentLatestActivity = {
  activity: {
    /** @description Persisted task timeline EventType; translate this identifier for display. */
    type: string;
    /** Format: date-time */
    occurredAt: string;
    /** Format: uuid */
    taskId: string;
    taskSlug: string;
    taskTitle: string;
    /** Format: uuid */
    eventId: string;
    /** Format: uuid */
    summaryId: string | null;
  } | null;
};
