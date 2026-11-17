CREATE TABLE agent_session_bindings (
 id uuid PRIMARY KEY DEFAULT uuidv7() CHECK(uuid_extract_version(id)=7),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND data ? 'endedAt'),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz, deleted_at timestamptz,
 agent_id uuid GENERATED ALWAYS AS ((data->>'agentId')::uuid) STORED NOT NULL REFERENCES agents(id)
);
CREATE UNIQUE INDEX agent_session_active_agent ON agent_session_bindings(agent_id) WHERE deleted_at IS NULL AND data->>'endedAt' IS NULL;
CREATE UNIQUE INDEX agent_session_active_destination ON agent_session_bindings((data->>'harness'),(data->>'installationId'),(data->>'externalId')) WHERE deleted_at IS NULL AND data->>'endedAt' IS NULL;
CREATE INDEX agent_session_history ON agent_session_bindings(agent_id,created_at,id) WHERE deleted_at IS NULL;
CREATE FUNCTION beeteam_session_binding_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Physical deletion is disabled' USING ERRCODE='23514'; END IF;
 IF (OLD.data->>'endedAt' IS NOT NULL AND NEW.data IS DISTINCT FROM OLD.data) OR (NEW.data-'endedAt'-'endedBy') IS DISTINCT FROM (OLD.data-'endedAt'-'endedBy') THEN
 RAISE EXCEPTION 'Session binding history is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER agent_session_immutable BEFORE UPDATE OR DELETE ON agent_session_bindings FOR EACH ROW EXECUTE FUNCTION beeteam_session_binding_immutable();
