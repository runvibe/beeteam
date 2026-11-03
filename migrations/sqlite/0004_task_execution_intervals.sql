-- Explicit task execution boundaries. No inferred historical attribution.
CREATE TABLE task_executions (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'), version INTEGER NOT NULL CHECK(version>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.agentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 start_summary_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.startSummaryId')) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED,
 source TEXT GENERATED ALWAYS AS (json_extract(data,'$.source')) STORED NOT NULL,
 session_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.sessionId')) STORED NOT NULL,
 coverage_root TEXT GENERATED ALWAYS AS (json_extract(data,'$.coverageRootSessionId')) STORED NOT NULL,
 state TEXT GENERATED ALWAYS AS (json_extract(data,'$.state')) STORED NOT NULL
);
CREATE INDEX task_executions_task_time ON task_executions(task_id,created_at,id);
CREATE TRIGGER task_executions_no_delete BEFORE DELETE ON task_executions BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE TABLE task_execution_intervals (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'), version INTEGER NOT NULL CHECK(version>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 execution_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.executionId')) STORED NOT NULL REFERENCES task_executions(id) DEFERRABLE INITIALLY DEFERRED,
 start_summary_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.startSummaryId')) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED,
 source TEXT GENERATED ALWAYS AS (json_extract(data,'$.source')) STORED NOT NULL,
 session_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.sessionId')) STORED NOT NULL,
 coverage_root TEXT GENERATED ALWAYS AS (json_extract(data,'$.coverageRootSessionId')) STORED NOT NULL,
 state TEXT GENERATED ALWAYS AS (json_extract(data,'$.state')) STORED NOT NULL,
 end_summary_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.endSummaryId')) STORED REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(state IN ('open','closed','incomplete','invalid'))
);
CREATE INDEX task_execution_intervals_task_time ON task_execution_intervals(task_id,created_at,id);
CREATE TRIGGER task_execution_intervals_no_delete BEFORE DELETE ON task_execution_intervals BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE TABLE task_execution_interval_counters (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'), version INTEGER NOT NULL CHECK(version>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 interval_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.intervalId')) STORED NOT NULL REFERENCES task_execution_intervals(id) DEFERRABLE INITIALLY DEFERRED,
 counter_key TEXT GENERATED ALWAYS AS (json_extract(data,'$.counterKey')) STORED NOT NULL,
 start_summary_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.calculation.segments[0].startSummaryId')) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_interval_counters_task_time ON task_execution_interval_counters(task_id,created_at,id);
CREATE TRIGGER task_execution_interval_counters_no_delete BEFORE DELETE ON task_execution_interval_counters BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE TABLE task_execution_tracking_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'), version INTEGER NOT NULL CHECK(version>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 execution_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.executionId')) STORED NOT NULL REFERENCES task_executions(id) DEFERRABLE INITIALLY DEFERRED,
 summary_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.summaryId')) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_tracking_events_task_time ON task_execution_tracking_events(task_id,created_at,id);
CREATE TRIGGER task_execution_tracking_events_no_delete BEFORE DELETE ON task_execution_tracking_events BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE TABLE task_execution_interval_revisions (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'), version INTEGER NOT NULL CHECK(version>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 interval_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.intervalId')) STORED NOT NULL REFERENCES task_execution_intervals(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_interval_revisions_task_time ON task_execution_interval_revisions(task_id,created_at,id);
CREATE TRIGGER task_execution_interval_revisions_no_delete BEFORE DELETE ON task_execution_interval_revisions BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE UNIQUE INDEX task_intervals_open_root ON task_execution_intervals(source,coverage_root) WHERE state='open' AND deleted_at IS NULL;
CREATE UNIQUE INDEX task_intervals_open_session ON task_execution_intervals(source,session_id) WHERE state='open' AND deleted_at IS NULL;
CREATE UNIQUE INDEX task_intervals_open_execution ON task_execution_intervals(execution_id) WHERE state='open' AND deleted_at IS NULL;
CREATE INDEX task_executions_agent ON task_executions(agent_id,created_at,id);
CREATE INDEX task_interval_counters_interval ON task_execution_interval_counters(interval_id);
CREATE INDEX task_interval_revisions_interval ON task_execution_interval_revisions(interval_id,created_at,id);
CREATE UNIQUE INDEX task_interval_counter_key ON task_execution_interval_counters(interval_id,counter_key);
CREATE UNIQUE INDEX task_interval_revision_number ON task_execution_interval_revisions(interval_id,json_extract(data,'$.revision'));
CREATE TRIGGER task_interval_revisions_immutable BEFORE UPDATE ON task_execution_interval_revisions BEGIN SELECT RAISE(ABORT,'Execution calculation revisions are immutable'); END;
