CREATE UNIQUE INDEX agents_system_key ON agents((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
