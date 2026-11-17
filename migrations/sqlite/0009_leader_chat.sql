CREATE TABLE leader_session_operations (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE leader_chats (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE leader_chat_turns (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE leader_chat_messages (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE leader_chat_approvals (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE TABLE leader_chat_events (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
CREATE UNIQUE INDEX leader_chat_binding ON leader_chats(json_extract(data,'$.bindingId')) WHERE deleted_at IS NULL;
CREATE INDEX leader_chat_team ON leader_chats(json_extract(data,'$.teamId'),id);
CREATE INDEX leader_chat_turns_chat ON leader_chat_turns(json_extract(data,'$.chatId'),id);
CREATE INDEX leader_chat_messages_chat ON leader_chat_messages(json_extract(data,'$.chatId'),id);
CREATE INDEX leader_chat_approvals_chat ON leader_chat_approvals(json_extract(data,'$.chatId'),id);
CREATE INDEX leader_chat_events_chat ON leader_chat_events(json_extract(data,'$.chatId'),id);
CREATE UNIQUE INDEX leader_message_client ON leader_chat_messages(json_extract(data,'$.chatId'),json_extract(data,'$.clientMessageId')) WHERE json_extract(data,'$.clientMessageId') IS NOT NULL;
CREATE UNIQUE INDEX leader_turn_active ON leader_chat_turns(json_extract(data,'$.bindingId')) WHERE json_extract(data,'$.status') IN ('queued','running','waiting_approval','cancel_requested','uncertain') AND deleted_at IS NULL;


CREATE TABLE leader_chat_tools (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 archived_at TEXT, deleted_at TEXT
);
