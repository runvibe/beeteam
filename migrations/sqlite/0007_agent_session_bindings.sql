CREATE TABLE agent_session_bindings (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND substr(id,15,1)='7' AND substr(id,20,1) IN ('8','9','a','b') AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND length(replace(id,'-',''))=32 AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*'),
 data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object' AND json_type(data,'$.endedAt') IS NOT NULL),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archived_at TEXT,deleted_at TEXT,
 agent_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.agentId')) STORED NOT NULL REFERENCES agents(id)
);
CREATE UNIQUE INDEX agent_session_active_agent ON agent_session_bindings(agent_id) WHERE deleted_at IS NULL AND json_extract(data,'$.endedAt') IS NULL;
CREATE UNIQUE INDEX agent_session_active_destination ON agent_session_bindings(json_extract(data,'$.harness'),json_extract(data,'$.installationId'),json_extract(data,'$.externalId')) WHERE deleted_at IS NULL AND json_extract(data,'$.endedAt') IS NULL;
CREATE INDEX agent_session_history ON agent_session_bindings(agent_id,created_at,id) WHERE deleted_at IS NULL;
CREATE TRIGGER agent_session_no_delete BEFORE DELETE ON agent_session_bindings BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
CREATE TRIGGER agent_session_immutable BEFORE UPDATE OF data ON agent_session_bindings WHEN (json_extract(OLD.data,'$.endedAt') IS NOT NULL AND NEW.data IS NOT OLD.data) OR json_remove(NEW.data,'$.endedAt','$.endedBy') IS NOT json_remove(OLD.data,'$.endedAt','$.endedBy') BEGIN SELECT RAISE(ABORT,'Session binding history is immutable'); END;
