CREATE UNIQUE INDEX agents_system_key ON agents(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
