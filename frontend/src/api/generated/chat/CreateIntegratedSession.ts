// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type CreateIntegratedSession = {
  /** @description Absolute existing project directory on the local host. */
  projectRoot: string;
  expectedBindingId: string | null;
  toolProfile?: import("./CodexToolProfile").CodexToolProfile;
};
