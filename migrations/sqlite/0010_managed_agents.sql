CREATE TABLE managed_conversations (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE managed_requests (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE managed_messages (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE managed_approvals (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE managed_events (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE INDEX managed_conversations_agentId ON managed_conversations (json_extract(data,'$.agentId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_requests_agentId ON managed_requests (json_extract(data,'$.agentId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_requests_state ON managed_requests (json_extract(data,'$.state'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_messages_conversationId ON managed_messages (json_extract(data,'$.conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_messages_requestId ON managed_messages (json_extract(data,'$.requestId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_approvals_conversationId ON managed_approvals (json_extract(data,'$.conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_approvals_requestId ON managed_approvals (json_extract(data,'$.requestId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_events_conversationId ON managed_events (json_extract(data,'$.conversationId'), id) WHERE deleted_at IS NULL;
CREATE INDEX managed_events_requestId ON managed_events (json_extract(data,'$.requestId'), id) WHERE deleted_at IS NULL;
