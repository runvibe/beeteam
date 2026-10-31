-- Usage evidence remains in the raw execution-summary document so portable
-- snapshots preserve it without a new transfer table or archive format.
CREATE VIEW summary_usage_entries AS
SELECT r.task_id, r.id AS summary_id, e.value AS entry
FROM execution_summaries r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.data->'usageReport'->'entries','[]'::jsonb)) e
WHERE r.deleted_at IS NULL;
CREATE INDEX execution_summaries_usage_task ON execution_summaries(task_id,created_at,id)
WHERE deleted_at IS NULL AND data->'usageReport' IS NOT NULL;
