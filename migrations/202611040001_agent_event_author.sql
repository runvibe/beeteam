-- Bound latest-activity candidate reads by declared agent; preserve all records.
CREATE INDEX events_agent_author ON events ((data->>'actorId'))
WHERE deleted_at IS NULL AND data->>'actorKind'='agent';
