CREATE TABLE session_deliveries (
 id uuid PRIMARY KEY DEFAULT uuidv7() CHECK(uuid_extract_version(id)=7),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, deleted_at timestamptz,
 task_id uuid GENERATED ALWAYS AS ((data->>'taskId')::uuid) STORED NOT NULL REFERENCES tasks(id),
 target_agent_id uuid GENERATED ALWAYS AS ((data->>'targetAgentId')::uuid) STORED NOT NULL REFERENCES agents(id)
);
CREATE UNIQUE INDEX session_delivery_source ON session_deliveries((data->>'sourceId'),target_agent_id,(data->>'kind'));
CREATE INDEX session_delivery_task ON session_deliveries(task_id,created_at,id);
CREATE INDEX session_delivery_pending ON session_deliveries((data->>'state'),created_at,id);
