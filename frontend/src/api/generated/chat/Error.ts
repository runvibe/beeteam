// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Error = {
  error: string;
  /**
   * @description Stable error identifier. Provider and storage adapters may add codes; clients must retain a generic fallback.
   * @example invalid_request
   * @example invalid_actor_context
   * @example not_found
   * @example version_required
   * @example version_conflict
   * @example idempotency_conflict
   * @example session_binding_conflict
   * @example external_mode
   * @example session_not_ready
   * @example turn_in_progress
   * @example approval_expired
   * @example cursor_expired
   * @example unsupported_capability
   * @example payload_too_large
   * @example storage_unavailable
   * @example internal_error
   * @example local_action_forbidden
   * @example session_creation_uncertain
   * @example session_busy
   * @example binding_chat_conflict
   * @example turn_not_uncertain
   * @example needs_auth
   */
  code: string;
  details: {
    [key: string]: unknown;
  };
};
