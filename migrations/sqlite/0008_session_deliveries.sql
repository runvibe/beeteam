CREATE TABLE session_deliveries (
 id TEXT PRIMARY KEY NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id),
 target_agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.targetAgentId')) STORED NOT NULL REFERENCES agents(id)
);
CREATE UNIQUE INDEX session_delivery_source ON session_deliveries(json_extract(data,'$.sourceId'),target_agent_id,json_extract(data,'$.kind'));
CREATE INDEX session_delivery_task ON session_deliveries(task_id,created_at,id);
CREATE INDEX session_delivery_pending ON session_deliveries(json_extract(data,'$.state'),created_at,id);
