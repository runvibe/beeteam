// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Error = {
  error: string;
  /** @enum {string} */
  code:
    | "invalid_request"
    | "invalid_actor_context"
    | "not_found"
    | "version_required"
    | "version_conflict"
    | "idempotency_conflict"
    | "session_binding_conflict"
    | "external_mode"
    | "session_not_ready"
    | "turn_in_progress"
    | "approval_expired"
    | "cursor_expired"
    | "unsupported_capability"
    | "payload_too_large"
    | "storage_unavailable"
    | "internal_error";
  details: {
    [key: string]: unknown;
  };
};
