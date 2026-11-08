// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type CodexToolProfile = {
  /**
   * @default live
   * @enum {string}
   */
  webSearch: "disabled" | "cached" | "live";
  /** @default true */
  networkAccess: boolean;
  /** @default [] */
  enabledMcpServers: string[];
  /** @default [] */
  skillRoots: string[];
};
