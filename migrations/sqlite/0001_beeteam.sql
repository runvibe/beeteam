-- Independent SQLite schema; JSON payloads retain the shared domain contracts.

CREATE TABLE agents (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 slug TEXT GENERATED ALWAYS AS (json_extract(data,'$.slug')) STORED NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND instr(slug,'--')=0)
);

CREATE INDEX agents_created ON agents(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER agents_no_delete BEFORE DELETE ON agents BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TRIGGER agents_immutable_slug BEFORE UPDATE OF data ON agents WHEN OLD.slug IS NOT NEW.slug BEGIN SELECT RAISE(ABORT,'Slugs are immutable'); END;

CREATE TABLE teams (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 leader_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.leaderId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 slug TEXT GENERATED ALWAYS AS (json_extract(data,'$.slug')) STORED NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND instr(slug,'--')=0)
);

CREATE INDEX teams_created ON teams(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER teams_no_delete BEFORE DELETE ON teams BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TRIGGER teams_immutable_slug BEFORE UPDATE OF data ON teams WHEN OLD.slug IS NOT NEW.slug BEGIN SELECT RAISE(ABORT,'Slugs are immutable'); END;

CREATE TABLE boards (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 team_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.teamId')) STORED NOT NULL REFERENCES teams(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX boards_created ON boards(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER boards_no_delete BEFORE DELETE ON boards BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE statuses (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 board_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.boardId')) STORED NOT NULL REFERENCES boards(id) DEFERRABLE INITIALLY DEFERRED,
 UNIQUE(board_id,id)
);

CREATE INDEX statuses_created ON statuses(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER statuses_no_delete BEFORE DELETE ON statuses BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE tasks (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 board_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.boardId')) STORED NOT NULL REFERENCES boards(id) DEFERRABLE INITIALLY DEFERRED,
 status_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.statusId')) STORED NOT NULL,
 parent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.parentId')) STORED  REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 executor_agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.executorAgentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 author_agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.authorAgentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 root_task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.rootTaskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 origin_board_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.originBoardId')) STORED NOT NULL REFERENCES boards(id) DEFERRABLE INITIALLY DEFERRED,
 slug TEXT GENERATED ALWAYS AS (json_extract(data,'$.slug')) STORED NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND instr(slug,'--')=0),
 UNIQUE(board_id,id),
 FOREIGN KEY(board_id,status_id) REFERENCES statuses(board_id,id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(parent_id IS NOT id),
 CHECK((json_type(data,'$.currentSummary')='text' AND length(CAST(json_extract(data,'$.currentSummary') AS BLOB))<=16384) IS TRUE),
 CHECK((json_type(data,'$.specification')='text' AND length(CAST(json_extract(data,'$.specification') AS BLOB))<=65536) IS TRUE)
);

CREATE INDEX tasks_created ON tasks(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER tasks_no_delete BEFORE DELETE ON tasks BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TRIGGER tasks_immutable_slug BEFORE UPDATE OF data ON tasks WHEN OLD.slug IS NOT NEW.slug BEGIN SELECT RAISE(ABORT,'Slugs are immutable'); END;

CREATE TABLE plans (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX plans_created ON plans(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER plans_no_delete BEFORE DELETE ON plans BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE plan_revisions (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 plan_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.planId')) STORED NOT NULL REFERENCES plans(id) DEFERRABLE INITIALLY DEFERRED,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX plan_revisions_created ON plan_revisions(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER plan_revisions_no_delete BEFORE DELETE ON plan_revisions BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE comments (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX comments_created ON comments(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER comments_no_delete BEFORE DELETE ON comments BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE attachments (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 content_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.contentId')) STORED NOT NULL REFERENCES file_contents(id) DEFERRABLE INITIALLY DEFERRED,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX attachments_created ON attachments(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER attachments_no_delete BEFORE DELETE ON attachments BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE execution_summaries (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX execution_summaries_created ON execution_summaries(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER execution_summaries_no_delete BEFORE DELETE ON execution_summaries BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 task_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.taskId')) STORED NOT NULL REFERENCES tasks(id) DEFERRABLE INITIALLY DEFERRED,
 sequence INTEGER GENERATED ALWAYS AS (json_extract(data,'$.sequence')) STORED NOT NULL UNIQUE
);

CREATE INDEX events_created ON events(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE chat_references (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.agentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX chat_references_created ON chat_references(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER chat_references_no_delete BEFORE DELETE ON chat_references BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE images (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.agentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED,
 content_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.contentId')) STORED NOT NULL REFERENCES file_contents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX images_created ON images(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER images_no_delete BEFORE DELETE ON images BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE memberships (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 team_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.teamId')) STORED NOT NULL REFERENCES teams(id) DEFERRABLE INITIALLY DEFERRED,
 agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.agentId')) STORED NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX memberships_created ON memberships(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER memberships_no_delete BEFORE DELETE ON memberships BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TABLE board_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT,
 board_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.boardId')) STORED NOT NULL REFERENCES boards(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX board_events_created ON board_events(created_at,id) WHERE deleted_at IS NULL;

CREATE TRIGGER board_events_no_delete BEFORE DELETE ON board_events BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE UNIQUE INDEX teams_active_leader ON teams(leader_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX memberships_active_agent ON memberships(agent_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX statuses_active_name ON statuses(board_id,trim(json_extract(data,'$.name')) COLLATE beeteam_nocase) WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX plan_revision_number ON plan_revisions(plan_id,json_extract(data,'$.revision')) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX chat_reference_external ON chat_references(agent_id,json_extract(data,'$.harness'),json_extract(data,'$.externalId')) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX images_active_agent ON images(agent_id) WHERE deleted_at IS NULL;

CREATE TABLE file_contents (id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), content BLOB NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE request_replays (id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'), request_key TEXT NOT NULL, actor_key TEXT NOT NULL, operation TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL CHECK(json_valid(response)), created_at TEXT NOT NULL, expires_at TEXT NOT NULL, deleted_at TEXT);

CREATE UNIQUE INDEX request_replays_live_key ON request_replays(actor_key,operation,request_key) WHERE deleted_at IS NULL;

CREATE TABLE beeteam_clock (id INTEGER PRIMARY KEY CHECK(id=1), sequence INTEGER NOT NULL, changes INTEGER NOT NULL);

INSERT INTO beeteam_clock VALUES(1,0,0);

CREATE TRIGGER file_contents_no_delete BEFORE DELETE ON file_contents BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TRIGGER request_replays_no_delete BEFORE DELETE ON request_replays BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;

CREATE TRIGGER task_structure_insert BEFORE INSERT ON tasks BEGIN
 SELECT CASE WHEN NEW.parent_id IS NULL AND (NEW.root_task_id IS NOT NEW.id OR NEW.origin_board_id IS NOT NEW.board_id) THEN RAISE(ABORT,'Invalid root execution context') END;
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks p WHERE p.id=NEW.parent_id AND p.root_task_id=NEW.root_task_id AND p.origin_board_id=NEW.origin_board_id) THEN RAISE(ABORT,'Invalid parent execution context') END;
 END;

CREATE TRIGGER task_structure_update BEFORE UPDATE ON tasks BEGIN
 SELECT CASE WHEN NEW.parent_id IS NULL AND (NEW.root_task_id IS NOT NEW.id OR NEW.origin_board_id IS NOT NEW.board_id) THEN RAISE(ABORT,'Invalid root execution context') END;
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks p WHERE p.id=NEW.parent_id AND p.root_task_id=NEW.root_task_id AND p.origin_board_id=NEW.origin_board_id) THEN RAISE(ABORT,'Invalid parent execution context') END;
 END;

CREATE TRIGGER tasks_immutable_structure BEFORE UPDATE OF data ON tasks WHEN NEW.parent_id IS NOT OLD.parent_id OR NEW.board_id IS NOT OLD.board_id OR NEW.root_task_id IS NOT OLD.root_task_id OR NEW.origin_board_id IS NOT OLD.origin_board_id OR NEW.author_agent_id IS NOT OLD.author_agent_id BEGIN SELECT RAISE(ABORT,'Task structure and author are immutable'); END;

CREATE TRIGGER teams_roles_insert AFTER INSERT ON teams BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL AND m.agent_id=t.leader_id) THEN RAISE(ABORT,'Agent cannot lead and collaborate in same team') END; END;

CREATE TRIGGER teams_roles_update AFTER UPDATE ON teams BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL AND m.agent_id=t.leader_id) THEN RAISE(ABORT,'Agent cannot lead and collaborate in same team') END; END;

CREATE TRIGGER memberships_roles_insert AFTER INSERT ON memberships BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL AND m.agent_id=t.leader_id) THEN RAISE(ABORT,'Agent cannot lead and collaborate in same team') END; END;

CREATE TRIGGER memberships_roles_update AFTER UPDATE ON memberships BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL AND m.agent_id=t.leader_id) THEN RAISE(ABORT,'Agent cannot lead and collaborate in same team') END; END;

CREATE INDEX teams_leader_id ON teams(leader_id) WHERE deleted_at IS NULL;

CREATE INDEX memberships_team_id ON memberships(team_id) WHERE deleted_at IS NULL;

CREATE INDEX memberships_agent_id ON memberships(agent_id) WHERE deleted_at IS NULL;

CREATE INDEX boards_team_id ON boards(team_id) WHERE deleted_at IS NULL;

CREATE INDEX statuses_board_id ON statuses(board_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_board_id ON tasks(board_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_status_id ON tasks(status_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_parent_id ON tasks(parent_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_executor_agent_id ON tasks(executor_agent_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_author_agent_id ON tasks(author_agent_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_root_task_id ON tasks(root_task_id) WHERE deleted_at IS NULL;

CREATE INDEX tasks_origin_board_id ON tasks(origin_board_id) WHERE deleted_at IS NULL;

CREATE INDEX plan_revisions_plan_id ON plan_revisions(plan_id) WHERE deleted_at IS NULL;

CREATE INDEX plan_revisions_task_id ON plan_revisions(task_id) WHERE deleted_at IS NULL;

CREATE INDEX attachments_content_id ON attachments(content_id) WHERE deleted_at IS NULL;

CREATE INDEX attachments_task_id ON attachments(task_id) WHERE deleted_at IS NULL;

CREATE INDEX images_agent_id ON images(agent_id) WHERE deleted_at IS NULL;

CREATE INDEX images_content_id ON images(content_id) WHERE deleted_at IS NULL;

CREATE INDEX chat_references_agent_id ON chat_references(agent_id) WHERE deleted_at IS NULL;

CREATE INDEX board_events_board_id ON board_events(board_id) WHERE deleted_at IS NULL;

CREATE INDEX plans_task_id ON plans(task_id) WHERE deleted_at IS NULL;

CREATE INDEX comments_task_id ON comments(task_id) WHERE deleted_at IS NULL;

CREATE INDEX execution_summaries_task_id ON execution_summaries(task_id) WHERE deleted_at IS NULL;

CREATE INDEX events_task_id ON events(task_id) WHERE deleted_at IS NULL;
