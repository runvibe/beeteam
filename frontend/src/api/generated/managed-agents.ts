export interface paths {
    "/api/v2/agents/{agentId}/execution-config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAgentExecutionConfiguration"];
        put: operations["configureAgentExecution"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agents/{agentId}/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAgentRequests"];
        put?: never;
        post: operations["sendAgentRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agents/{agentId}/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAgentConversations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAgentRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Team leader sessions across agents. Filters accept comma-separated UUIDv7 lists (at most 50 each); boardId also accepts `none` for sessions without a board. */
        get: operations["listAgentSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-conversations/{conversationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["updateAgentConversation"];
        trace?: never;
    };
    "/api/v2/agent-conversations/{conversationId}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAgentConversationMessages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-requests/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancelAgentRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-requests/{requestId}/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["reconcileAgentRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-approvals/{approvalId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["decideAgentRequestApproval"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/agent-requests/{requestId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["streamAgentRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/teams/{teamId}/managed-approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listTeamManagedApprovals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ToolProfile: {
            /** @enum {unknown} */
            webSearch: "live" | "cached" | "disabled";
            networkAccess: boolean;
            enabledMcpServers: string[];
            skillRoots: string[];
        };
        ExecutionConfiguration: {
            /** @enum {unknown} */
            provider: "codex";
            toolProfile: components["schemas"]["ToolProfile"];
        };
        ConfigurationState: {
            /** Format: uuid */
            agentId: string;
            version: number;
            configuration: components["schemas"]["ExecutionConfiguration"] | null;
            /** @enum {unknown} */
            readiness: "unconfigured" | "ready" | "needs_auth" | "unavailable" | "busy" | "uncertain" | "configured";
        };
        SendAgentRequest: {
            content: string & (unknown & unknown);
            conversationId?: string | null;
            taskId?: string | null;
            /** @description Creates the new conversation as a session of this team; the agent must be its current leader. On continuation it must match. */
            teamId?: string | null;
            /** @description Optional board of the team session; requires teamId and must belong to that team. */
            boardId?: string | null;
        };
        /** @enum {unknown} */
        RequestState: "accepted" | "preparing" | "queued" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled" | "uncertain";
        RequestError: {
            /** @enum {unknown} */
            code: "needs_configuration" | "needs_auth" | "provider_unavailable" | "execution_failed" | "configuration_changed" | "cancelled" | "outcome_unknown";
            message: string & (unknown & unknown);
            retryable: boolean;
        };
        Origin: {
            /** @enum {unknown} */
            transport: "http" | "mcp" | "conversation" | "summary_notice";
            label: (string & (unknown & unknown)) | null;
        };
        AgentRequest: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            agentId: string;
            /** Format: uuid */
            conversationId: string;
            taskId: string | null;
            configurationVersion: number;
            version: number;
            state: components["schemas"]["RequestState"];
            origin: components["schemas"]["Origin"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            error: components["schemas"]["RequestError"] | null;
        };
        Conversation: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            agentId: string;
            configurationVersion: number;
            taskId: string | null;
            /** @description Team whose leader owns this session; null for task and direct agent conversations. */
            teamId: string | null;
            /** @description Optional board context of a team session. */
            boardId: string | null;
            title: string & (unknown & unknown);
            readOnly: boolean;
            version: number;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: date-time
             * @description Last session activity or metadata change.
             */
            updatedAt: string;
        };
        PatchConversation: {
            title?: string & (unknown & unknown);
            /** @description Board of the team session, or null to clear it. */
            boardId?: string | null;
        };
        Message: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            conversationId: string;
            /** Format: uuid */
            requestId: string;
            /** @enum {unknown} */
            role: "requester" | "agent" | "system";
            content: string;
            version: number;
            /** Format: date-time */
            createdAt: string;
        };
        RequestPage: {
            items: components["schemas"]["AgentRequest"][];
            nextCursor: string | null;
        };
        ConversationPage: {
            items: components["schemas"]["Conversation"][];
            nextCursor: string | null;
        };
        MessagePage: {
            items: components["schemas"]["Message"][];
            nextCursor: string | null;
        };
        Approval: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            agentId: string;
            version: number;
            /** @enum {unknown} */
            kind: "command" | "file_change" | "network";
            description: string & (unknown & unknown);
            /** @enum {unknown} */
            state: "pending" | "accepted" | "declined" | "expired";
            expiresAt: string | null;
        };
        ApprovalDecision: {
            /** @enum {unknown} */
            decision: "accept" | "decline";
            /**
             * Format: uuid
             * @description Require the approval agent to remain a current worker of this team; a transfer returns approval_team_mismatch.
             */
            expectedTeamId?: string;
        };
        RequestSnapshot: {
            request: components["schemas"]["AgentRequest"];
            messages: components["schemas"]["MessagePage"];
            approvals: components["schemas"]["Approval"][];
            eventCursor: string;
        };
        Error: {
            /** @enum {unknown} */
            code: "invalid_request" | "payload_too_large" | "not_found" | "local_action_forbidden" | "configuration_busy" | "configuration_changed" | "conversation_mismatch" | "queue_full" | "idempotency_conflict" | "version_conflict" | "approval_expired" | "outcome_unknown" | "operation_removed" | "unsupported_capability" | "cursor_expired" | "internal_error" | "approval_team_mismatch";
            message: string & (unknown & unknown);
            retryable: boolean;
        };
        RequestEvent: {
            /** @constant */
            schemaVersion: 1;
            /** @enum {unknown} */
            type: "request.updated" | "snapshot.required";
            cursor: string & (unknown & unknown);
            request: components["schemas"]["AgentRequest"];
        };
        ManagedApprovalAgent: {
            /** Format: uuid */
            id: string;
            name: string;
        };
        TeamManagedApproval: {
            approval: components["schemas"]["Approval"];
            request: components["schemas"]["AgentRequest"];
            agent: components["schemas"]["ManagedApprovalAgent"];
        };
        TeamManagedApprovalPage: {
            items: components["schemas"]["TeamManagedApproval"][];
            nextCursor: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getAgentExecutionConfiguration: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationState"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    configureAgentExecution: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecutionConfiguration"];
            };
        };
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationState"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAgentRequests: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RequestPage"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    sendAgentRequest: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendAgentRequest"];
            };
        };
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentRequest"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAgentConversations: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationPage"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getAgentRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RequestSnapshot"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAgentSessions: {
        parameters: {
            query?: {
                /** @description Comma-separated team IDs. */
                teamId?: string;
                /** @description Comma-separated leader agent IDs. */
                agentId?: string;
                /** @description Comma-separated board IDs or `none`. */
                boardId?: string;
                sort?: "updated_desc" | "updated_asc";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationPage"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    updateAgentConversation: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PatchConversation"];
            };
        };
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Conversation"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAgentConversationMessages: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessagePage"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    cancelAgentRequest: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentRequest"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    reconcileAgentRequest: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentRequest"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decideAgentRequestApproval: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                approvalId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApprovalDecision"];
            };
        };
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Approval"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    streamAgentRequest: {
        parameters: {
            query?: never;
            header?: {
                "Last-Event-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful contract response. This proposal is not an active runtime endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listTeamManagedApprovals: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                teamId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Pending managed approvals for current worker memberships. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamManagedApprovalPage"];
                };
            };
            /** @description See normative status mapping. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
