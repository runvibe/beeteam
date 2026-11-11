// Generated from contracts/ra-openapi.yaml. Do not edit.
export type SessionDescriptor = {
  /** @enum {string} */
  harness: "codex" | "claude-code";
  installationId: string;
  externalId: string;
  /** @description Declared absolute project root; not a grant of filesystem access. */
  projectRoot: string;
  /**
   * @description Declared harness sessions are external. Integrated sessions must be created by the managed bootstrap.
   * @default external
   * @enum {string}
   */
  mode: "external";
};
