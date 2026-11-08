CREATE TABLE leader_session_operations (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE leader_chats (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE leader_chat_turns (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE leader_chat_messages (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE leader_chat_approvals (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE leader_chat_events (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX leader_chat_binding ON leader_chats((data->>'bindingId')) WHERE deleted_at IS NULL;
CREATE INDEX leader_chat_team ON leader_chats((data->>'teamId'),id);
CREATE INDEX leader_chat_turns_chat ON leader_chat_turns((data->>'chatId'),id);
CREATE INDEX leader_chat_messages_chat ON leader_chat_messages((data->>'chatId'),id);
CREATE INDEX leader_chat_approvals_chat ON leader_chat_approvals((data->>'chatId'),id);
CREATE INDEX leader_chat_events_chat ON leader_chat_events((data->>'chatId'),id);
CREATE UNIQUE INDEX leader_message_client ON leader_chat_messages((data->>'chatId'),(data->>'clientMessageId')) WHERE (data->>'clientMessageId') IS NOT NULL;
CREATE UNIQUE INDEX leader_turn_active ON leader_chat_turns((data->>'bindingId')) WHERE (data->>'status') IN ('queued','running','waiting_approval','cancel_requested','uncertain') AND deleted_at IS NULL;


CREATE TABLE leader_chat_tools (
 id UUID PRIMARY KEY NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
