-- Explicit task execution boundaries. No inferred historical attribution.
CREATE TABLE task_executions (
 id uuid PRIMARY KEY CHECK(uuid_extract_version(id)=7), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version bigint NOT NULL CHECK(version>0), created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 agent_id uuid GENERATED ALWAYS AS ((data->>'agentId')::uuid) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 start_summary_id uuid GENERATED ALWAYS AS ((data->>'startSummaryId')::uuid) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED,
 source TEXT GENERATED ALWAYS AS (data->>'source') STORED NOT NULL,
 session_id TEXT GENERATED ALWAYS AS (data->>'sessionId') STORED NOT NULL,
 coverage_root TEXT GENERATED ALWAYS AS (data->>'coverageRootSessionId') STORED NOT NULL,
 state TEXT GENERATED ALWAYS AS (data->>'state') STORED NOT NULL
);
CREATE INDEX task_executions_task_time ON task_executions(task_id,created_at,id);
CREATE TRIGGER task_executions_no_delete BEFORE DELETE ON task_executions FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE TABLE task_execution_intervals (
 id uuid PRIMARY KEY CHECK(uuid_extract_version(id)=7), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version bigint NOT NULL CHECK(version>0), created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 execution_id uuid GENERATED ALWAYS AS ((data->>'executionId')::uuid) STORED NOT NULL REFERENCES task_executions(id) DEFERRABLE INITIALLY DEFERRED,
 start_summary_id uuid GENERATED ALWAYS AS ((data->>'startSummaryId')::uuid) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED,
 source TEXT GENERATED ALWAYS AS (data->>'source') STORED NOT NULL,
 session_id TEXT GENERATED ALWAYS AS (data->>'sessionId') STORED NOT NULL,
 coverage_root TEXT GENERATED ALWAYS AS (data->>'coverageRootSessionId') STORED NOT NULL,
 state TEXT GENERATED ALWAYS AS (data->>'state') STORED NOT NULL
);
CREATE INDEX task_execution_intervals_task_time ON task_execution_intervals(task_id,created_at,id);
CREATE TRIGGER task_execution_intervals_no_delete BEFORE DELETE ON task_execution_intervals FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE TABLE task_execution_interval_counters (
 id uuid PRIMARY KEY CHECK(uuid_extract_version(id)=7), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version bigint NOT NULL CHECK(version>0), created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 interval_id uuid GENERATED ALWAYS AS ((data->>'intervalId')::uuid) STORED NOT NULL REFERENCES task_execution_intervals(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_interval_counters_task_time ON task_execution_interval_counters(task_id,created_at,id);
CREATE TRIGGER task_execution_interval_counters_no_delete BEFORE DELETE ON task_execution_interval_counters FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE TABLE task_execution_tracking_events (
 id uuid PRIMARY KEY CHECK(uuid_extract_version(id)=7), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version bigint NOT NULL CHECK(version>0), created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 execution_id uuid GENERATED ALWAYS AS ((data->>'executionId')::uuid) STORED NOT NULL REFERENCES task_executions(id) DEFERRABLE INITIALLY DEFERRED,
 summary_id uuid GENERATED ALWAYS AS ((data->>'summaryId')::uuid) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_tracking_events_task_time ON task_execution_tracking_events(task_id,created_at,id);
CREATE TRIGGER task_execution_tracking_events_no_delete BEFORE DELETE ON task_execution_tracking_events FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE TABLE task_execution_interval_revisions (
 id uuid PRIMARY KEY CHECK(uuid_extract_version(id)=7), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version bigint NOT NULL CHECK(version>0), created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 interval_id uuid GENERATED ALWAYS AS ((data->>'intervalId')::uuid) STORED NOT NULL REFERENCES task_execution_intervals(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX task_execution_interval_revisions_task_time ON task_execution_interval_revisions(task_id,created_at,id);
CREATE TRIGGER task_execution_interval_revisions_no_delete BEFORE DELETE ON task_execution_interval_revisions FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE UNIQUE INDEX task_intervals_open_root ON task_execution_intervals(source,coverage_root) WHERE state='open' AND deleted_at IS NULL;
CREATE UNIQUE INDEX task_intervals_open_session ON task_execution_intervals(source,session_id) WHERE state='open' AND deleted_at IS NULL;
CREATE UNIQUE INDEX task_intervals_open_execution ON task_execution_intervals(execution_id) WHERE state='open' AND deleted_at IS NULL;
CREATE INDEX task_executions_agent ON task_executions(agent_id,created_at,id);
CREATE INDEX task_interval_counters_interval ON task_execution_interval_counters(interval_id);
CREATE INDEX task_interval_revisions_interval ON task_execution_interval_revisions(interval_id,created_at,id);
ALTER TABLE task_execution_interval_counters ADD counter_key TEXT GENERATED ALWAYS AS (data->>'counterKey') STORED NOT NULL;
ALTER TABLE task_execution_interval_counters ADD start_summary_id uuid GENERATED ALWAYS AS ((data->'calculation'->'segments'->0->>'startSummaryId')::uuid) STORED NOT NULL REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE task_execution_intervals ADD end_summary_id uuid GENERATED ALWAYS AS ((data->>'endSummaryId')::uuid) STORED REFERENCES execution_summaries(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE task_executions ADD CHECK(state IN ('active','paused','finished'));
ALTER TABLE task_execution_intervals ADD CHECK(state IN ('open','closed','incomplete','invalid'));
CREATE UNIQUE INDEX task_interval_counter_key ON task_execution_interval_counters(interval_id,counter_key);
CREATE UNIQUE INDEX task_interval_revision_number ON task_execution_interval_revisions(interval_id,(data->>'revision'));
CREATE FUNCTION beeteam_reject_execution_audit_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Execution calculation revisions are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER task_interval_revisions_immutable BEFORE UPDATE ON task_execution_interval_revisions FOR EACH ROW EXECUTE FUNCTION beeteam_reject_execution_audit_update();
