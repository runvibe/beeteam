-- Preserve legacy task content; never infer requirements from description or plans.
UPDATE tasks SET data = data || '{"specification":""}'::jsonb
WHERE NOT (data ? 'specification');
ALTER TABLE tasks ADD CONSTRAINT task_specification CHECK (
    (jsonb_typeof(data->'specification') = 'string'
     AND octet_length(data->>'specification') <= 65536) IS TRUE
);
