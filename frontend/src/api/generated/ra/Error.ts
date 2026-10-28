// Generated from contracts/ra-openapi.yaml. Do not edit.
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
    | "team_in_use"
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
    | "invalid_composition"
    | "role_cardinality_conflict"
    | "same_team_roles"
    | "leader_required"
    | "leadership_cycle"
    | "agent_in_use"
    | "assignment_in_use"
    | "composition_conflict"
    | "invalid_actor_context"
    | "usage_policy_conflict";
  details: {
    [key: string]: unknown;
  };
};
