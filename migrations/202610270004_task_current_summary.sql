-- Explicit empty state for existing tasks; never derive text from historical records.
-- JSONB storage is already loaded with each task, avoiding a per-card history query.
UPDATE tasks SET data = data || '{"currentSummary":""}'::jsonb
WHERE NOT (data ? 'currentSummary');
ALTER TABLE tasks ADD CONSTRAINT task_current_summary CHECK (
    (jsonb_typeof(data->'currentSummary') = 'string'
     AND octet_length(data->>'currentSummary') <= 16384) IS TRUE
);
