-- Team leader sessions: backfill the team of existing ad-hoc leader conversations and index session listing.
UPDATE managed_conversations c
SET data=jsonb_set(c.data,'{teamId}',to_jsonb(t.id::text))
FROM teams t
WHERE c.deleted_at IS NULL
 AND c.data->>'teamId' IS NULL
 AND c.data->>'taskId' IS NULL
 AND t.deleted_at IS NULL
 AND CAST(t.leader_id AS TEXT)=c.data->>'agentId';
CREATE INDEX managed_conversations_sessions ON managed_conversations (updated_at, id) WHERE deleted_at IS NULL AND data->>'teamId' IS NOT NULL;
CREATE INDEX managed_conversations_team ON managed_conversations ((data->>'teamId'), updated_at, id) WHERE deleted_at IS NULL;
CREATE INDEX managed_conversations_board ON managed_conversations ((data->>'boardId'), updated_at, id) WHERE deleted_at IS NULL;
