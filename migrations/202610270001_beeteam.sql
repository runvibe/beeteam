-- PostgreSQL 18 supplies uuidv7(); do not rewrite legacy migrations or identities.
DO $$ BEGIN
  IF current_setting('server_version_num')::int < 180000 THEN
    RAISE EXCEPTION 'Bee Team requires PostgreSQL 18 or newer';
  END IF;
END $$;

CREATE FUNCTION beeteam_reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Physical deletion is disabled; set deleted_at instead' USING ERRCODE='23514'; END $$;

-- Resource payloads hold content; relationships, lifecycle, versions and uniqueness
-- are relational. Each resource kind has its own table and constraints.
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id)=7),
  data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz, deleted_at timestamptz,
  UNIQUE(id)
);
CREATE TABLE teams (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE teams ADD leader_id uuid GENERATED ALWAYS AS ((data->>'leaderId')::uuid) STORED NOT NULL;
ALTER TABLE teams ADD FOREIGN KEY(leader_id) REFERENCES agents(id);
CREATE UNIQUE INDEX teams_active_leader ON teams(leader_id) WHERE deleted_at IS NULL;

CREATE TABLE memberships (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE memberships ADD team_id uuid GENERATED ALWAYS AS ((data->>'teamId')::uuid) STORED NOT NULL;
ALTER TABLE memberships ADD agent_id uuid GENERATED ALWAYS AS ((data->>'agentId')::uuid) STORED NOT NULL;
ALTER TABLE memberships ADD FOREIGN KEY(team_id) REFERENCES teams(id);
ALTER TABLE memberships ADD FOREIGN KEY(agent_id) REFERENCES agents(id);
CREATE UNIQUE INDEX memberships_active_agent ON memberships(agent_id) WHERE deleted_at IS NULL;

CREATE TABLE boards (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE boards ADD team_id uuid GENERATED ALWAYS AS ((data->>'teamId')::uuid) STORED NOT NULL;
ALTER TABLE boards ADD FOREIGN KEY(team_id) REFERENCES teams(id);

CREATE TABLE statuses (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE statuses ADD board_id uuid GENERATED ALWAYS AS ((data->>'boardId')::uuid) STORED NOT NULL;
ALTER TABLE statuses ADD FOREIGN KEY(board_id) REFERENCES boards(id);
ALTER TABLE statuses ADD UNIQUE(board_id,id);
CREATE UNIQUE INDEX statuses_active_name ON statuses(board_id,lower(btrim(data->>'name'))) WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE TABLE tasks (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE tasks ADD board_id uuid GENERATED ALWAYS AS ((data->>'boardId')::uuid) STORED NOT NULL;
ALTER TABLE tasks ADD status_id uuid GENERATED ALWAYS AS ((data->>'statusId')::uuid) STORED NOT NULL;
ALTER TABLE tasks ADD parent_id uuid GENERATED ALWAYS AS ((data->>'parentId')::uuid) STORED;
ALTER TABLE tasks ADD executor_agent_id uuid GENERATED ALWAYS AS ((data->>'executorAgentId')::uuid) STORED NOT NULL;
ALTER TABLE tasks ADD UNIQUE(board_id,id);
ALTER TABLE tasks ADD FOREIGN KEY(board_id) REFERENCES boards(id);
ALTER TABLE tasks ADD FOREIGN KEY(board_id,status_id) REFERENCES statuses(board_id,id);
ALTER TABLE tasks ADD FOREIGN KEY(parent_id) REFERENCES tasks(id);
ALTER TABLE tasks ADD FOREIGN KEY(executor_agent_id) REFERENCES agents(id);
ALTER TABLE tasks ADD CHECK(parent_id IS DISTINCT FROM id);
ALTER TABLE tasks ADD author_agent_id uuid GENERATED ALWAYS AS ((data->>'authorAgentId')::uuid) STORED NOT NULL REFERENCES agents(id);
ALTER TABLE tasks ADD root_task_id uuid GENERATED ALWAYS AS ((data->>'rootTaskId')::uuid) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE tasks ADD origin_board_id uuid GENERATED ALWAYS AS ((data->>'originBoardId')::uuid) STORED NOT NULL REFERENCES boards(id);
CREATE FUNCTION beeteam_task_structure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_data jsonb; BEGIN
  IF TG_OP='UPDATE' AND (NEW.data->'parentId' IS DISTINCT FROM OLD.data->'parentId' OR NEW.data->'boardId' IS DISTINCT FROM OLD.data->'boardId' OR NEW.data->'rootTaskId' IS DISTINCT FROM OLD.data->'rootTaskId' OR NEW.data->'originBoardId' IS DISTINCT FROM OLD.data->'originBoardId' OR NEW.data->'authorAgentId' IS DISTINCT FROM OLD.data->'authorAgentId') THEN
    RAISE EXCEPTION 'Task structure and author are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.data->>'parentId' IS NULL THEN
    IF NEW.data->>'rootTaskId' <> NEW.id::text OR NEW.data->>'originBoardId' <> NEW.data->>'boardId' THEN
      RAISE EXCEPTION 'Invalid root execution context' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT data INTO parent_data FROM tasks WHERE id=(NEW.data->>'parentId')::uuid;
    IF parent_data IS NULL OR NEW.data->>'rootTaskId' IS DISTINCT FROM parent_data->>'rootTaskId' OR NEW.data->>'originBoardId' IS DISTINCT FROM parent_data->>'originBoardId' THEN
      RAISE EXCEPTION 'Invalid parent execution context' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_structure BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION beeteam_task_structure();

CREATE TABLE plans (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE plan_revisions (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE comments (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE attachments (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE execution_summaries (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE events (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE SEQUENCE beeteam_event_sequence;
ALTER TABLE events ADD sequence bigint NOT NULL DEFAULT nextval('beeteam_event_sequence');
CREATE UNIQUE INDEX events_sequence ON events(sequence);

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['plans','plan_revisions','comments','attachments','execution_summaries','events'] LOOP
    EXECUTE format('ALTER TABLE %I ADD task_id uuid GENERATED ALWAYS AS ((data->>''taskId'')::uuid) STORED NOT NULL',tab);
    EXECUTE format('ALTER TABLE %I ADD FOREIGN KEY(task_id) REFERENCES tasks(id)',tab);
  END LOOP;
END $$;
ALTER TABLE plan_revisions ADD plan_id uuid GENERATED ALWAYS AS ((data->>'planId')::uuid) STORED NOT NULL;
ALTER TABLE plan_revisions ADD FOREIGN KEY(plan_id) REFERENCES plans(id);
CREATE UNIQUE INDEX plan_revision_number ON plan_revisions(plan_id,((data->>'revision')::int)) WHERE deleted_at IS NULL;

CREATE TABLE chat_references (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE chat_references ADD agent_id uuid GENERATED ALWAYS AS ((data->>'agentId')::uuid) STORED NOT NULL;
ALTER TABLE chat_references ADD FOREIGN KEY(agent_id) REFERENCES agents(id);
CREATE UNIQUE INDEX chat_reference_external ON chat_references(agent_id,(data->>'harness'),(data->>'externalId')) WHERE deleted_at IS NULL;

CREATE TABLE images (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE images ADD agent_id uuid GENERATED ALWAYS AS ((data->>'agentId')::uuid) STORED NOT NULL;
ALTER TABLE images ADD FOREIGN KEY(agent_id) REFERENCES agents(id);
CREATE UNIQUE INDEX images_active_agent ON images(agent_id) WHERE deleted_at IS NULL;

CREATE TABLE file_contents (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK(uuid_extract_version(id)=7),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(id)
);
ALTER TABLE attachments ADD content_id uuid GENERATED ALWAYS AS ((data->>'contentId')::uuid) STORED NOT NULL;
ALTER TABLE attachments ADD FOREIGN KEY(content_id) REFERENCES file_contents(id);
ALTER TABLE images ADD content_id uuid GENERATED ALWAYS AS ((data->>'contentId')::uuid) STORED NOT NULL;
ALTER TABLE images ADD FOREIGN KEY(content_id) REFERENCES file_contents(id);

CREATE TABLE request_replays (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK(uuid_extract_version(id)=7),
  request_key uuid NOT NULL,
  actor_key text NOT NULL, operation text NOT NULL, request_hash text NOT NULL,
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', deleted_at timestamptz
);
CREATE UNIQUE INDEX request_replays_live_key ON request_replays(actor_key,operation,request_key) WHERE deleted_at IS NULL;

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['agents','teams','memberships','boards','statuses','tasks','plans','plan_revisions','comments','attachments','execution_summaries','events','chat_references','images'] LOOP
    EXECUTE format('CREATE INDEX ON %I(created_at,id) WHERE deleted_at IS NULL',tab);
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['agents','teams','memberships','boards','statuses','tasks','plans','plan_revisions','comments','attachments','execution_summaries','events','chat_references','images','file_contents','request_replays','authors','posts'] LOOP
    IF tab IN ('authors','posts') THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at timestamptz',tab);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT persisted_uuidv7 CHECK(uuid_extract_version(id)=7) NOT VALID',tab);
    END IF;
    EXECUTE format('CREATE TRIGGER reject_physical_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete()',tab);
    EXECUTE format('CREATE TRIGGER reject_physical_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION beeteam_reject_delete()',tab);
  END LOOP;
END $$;

CREATE TABLE board_events (LIKE agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE board_events ADD board_id uuid GENERATED ALWAYS AS ((data->>'boardId')::uuid) STORED NOT NULL REFERENCES boards(id);
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON board_events FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete();
CREATE TRIGGER reject_physical_truncate BEFORE TRUNCATE ON board_events FOR EACH STATEMENT EXECUTE FUNCTION beeteam_reject_delete();
