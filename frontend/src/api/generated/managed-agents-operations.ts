import type { components } from "./managed-agents";
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
    getAgentConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current conversation metadata. */
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
    getAgentConversationMessageImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
                messageId: string;
                imageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Image bytes with the stored media type. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                    "image/jpeg": string;
                    "image/webp": string;
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
    downloadAgentConversationMessageFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
                messageId: string;
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stored file bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                    "application/pdf": string;
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
    previewAgentConversationMessageFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
                messageId: string;
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stored file bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
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
    recoverAgentConversationMessageFiles: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "If-Match": string;
            };
            path: {
                conversationId: string;
                messageId: string;
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
                    "application/json": components["schemas"]["Message"];
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
