// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type IntegratedSession = {
  /** Format: uuid */
  agentId: string;
  /** Format: uuid */
  bindingId: string;
  /** @enum {string} */
  harness: "codex";
  /** @enum {string} */
  mode: "integrated";
  externalId: string;
  projectRoot: string;
};
