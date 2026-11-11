// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Error = {
  error: string;
  /** @enum {string} */
  code:
    | "invalid_request"
    | "coordination_context_required"
    | "coordination_mode_mismatch"
    | "not_found"
    | "archived_resource"
    | "status_in_use"
    | "summary_required"
    | "task_blocked"
    | "revision_conflict"
    | "idempotency_conflict"
    | "duplicate_status"
    | "version_conflict"
    | "version_required"
    | "payload_too_large"
    | "unsupported_media_type"
    | "internal_error"
    | "storage_unavailable"
    | "invalid_actor_context"
    | "usage_attribution_conflict"
    | "system_resource_protected"
    | "usage_policy_conflict"
    | "parent_cycle"
    | "active_execution_interval"
    | "execution_context_mismatch";
  details: {
    [key: string]: unknown;
  };
};
