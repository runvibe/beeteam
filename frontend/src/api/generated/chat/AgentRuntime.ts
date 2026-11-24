// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type AgentRuntime = {
  /** Format: uuid */
  agentId: string;
  /** @enum {string} */
  mode: "external" | "integrated";
  harness: string;
  bindingId: string | null;
  /** @enum {string} */
  readiness: "external" | "unavailable" | "needs_auth" | "ready" | "busy";
  capabilities: {
    streaming: boolean;
    resume: boolean;
    interrupt: boolean;
    approvals: boolean;
    skills: boolean;
    mcp: boolean;
    webSearch: boolean;
  };
  tools: {
    /** @enum {string} */
    webSearch: "disabled" | "cached" | "live";
    networkAccess: boolean;
    skills: {
      id: string;
      name: string;
      enabled: boolean;
      available: boolean;
    }[];
    mcpServers: {
      id: string;
      name: string;
      enabled: boolean;
      /** @enum {string} */
      status: "connected" | "disabled" | "needs_auth" | "failed";
    }[];
  };
};
