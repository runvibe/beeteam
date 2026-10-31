CREATE VIEW summary_usage_entries AS
SELECT r.task_id, r.id AS summary_id, e.value AS entry
FROM execution_summaries r, json_each(r.data,'$.usageReport.entries') e
WHERE r.deleted_at IS NULL;
CREATE INDEX execution_summaries_usage_task ON execution_summaries(task_id,created_at,id)
WHERE deleted_at IS NULL AND json_type(data,'$.usageReport')='object';
