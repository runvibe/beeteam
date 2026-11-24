CREATE TABLE managed_conversations (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE managed_requests (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE managed_messages (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE managed_approvals (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE managed_events (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE INDEX managed_conversations_agentId ON managed_conversations ((data->>'agentId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_requests_agentId ON managed_requests ((data->>'agentId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_requests_state ON managed_requests ((data->>'state'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_messages_conversationId ON managed_messages ((data->>'conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_messages_requestId ON managed_messages ((data->>'requestId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_approvals_conversationId ON managed_approvals ((data->>'conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_approvals_requestId ON managed_approvals ((data->>'requestId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_events_conversationId ON managed_events ((data->>'conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_events_requestId ON managed_events ((data->>'requestId'), id) WHERE deleted_at IS NULL;
