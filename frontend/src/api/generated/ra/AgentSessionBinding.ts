// Generated from contracts/ra-openapi.yaml. Do not edit.
export type AgentSessionBinding = {
  /** @enum {string} */
  harness: "codex" | "claude-code";
  installationId: string;
  externalId: string;
  /** @description Declared absolute project root; not a grant of filesystem access. */
  projectRoot: string;
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  agentId: string;
  /** Format: date-time */
  startedAt: string;
  /** Format: date-time */
  endedAt: string | null;
  startedBy: Record<string, never>;
  endedBy: Record<string, never> | null;
  /**
   * @description Verified means local managed-session preflight succeeded; not proof of a completed task.
   * @enum {string}
   */
  verification: "declared" | "verified";
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  /**
   * @description Missing on legacy records means external; integrated bindings are created by Bee Team.
   * @default external
   * @enum {string}
   */
  mode: "external" | "integrated";
  toolProfile?: {
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
};
