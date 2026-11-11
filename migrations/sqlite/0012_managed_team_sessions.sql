-- Team leader sessions: backfill the team of existing ad-hoc leader conversations and index session listing.
UPDATE managed_conversations
SET data=json_set(data,'$.teamId',(SELECT t.id FROM teams t WHERE t.deleted_at IS NULL AND t.leader_id=json_extract(managed_conversations.data,'$.agentId')))
WHERE deleted_at IS NULL
 AND json_extract(data,'$.teamId') IS NULL
 AND json_extract(data,'$.taskId') IS NULL
 AND EXISTS (SELECT 1 FROM teams t WHERE t.deleted_at IS NULL AND t.leader_id=json_extract(managed_conversations.data,'$.agentId'));
CREATE INDEX managed_conversations_sessions ON managed_conversations (updated_at, id) WHERE deleted_at IS NULL AND json_extract(data,'$.teamId') IS NOT NULL;
CREATE INDEX managed_conversations_team ON managed_conversations (json_extract(data,'$.teamId'), updated_at, id) WHERE deleted_at IS NULL;
CREATE INDEX managed_conversations_board ON managed_conversations (json_extract(data,'$.boardId'), updated_at, id) WHERE deleted_at IS NULL;
