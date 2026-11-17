CREATE UNIQUE INDEX agents_system_key ON agents(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;

-- Portable restore may remove untouched onboarding seed rows (data.onboardingSeedVersion = version)
-- only while it holds a row in beeteam_seed_cleanup inside its own transaction.
CREATE TABLE beeteam_seed_cleanup(singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton=1));
DROP TRIGGER events_no_delete;
CREATE TRIGGER events_no_delete BEFORE DELETE ON events WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER tasks_no_delete;
CREATE TRIGGER tasks_no_delete BEFORE DELETE ON tasks WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER statuses_no_delete;
CREATE TRIGGER statuses_no_delete BEFORE DELETE ON statuses WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER boards_no_delete;
CREATE TRIGGER boards_no_delete BEFORE DELETE ON boards WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER memberships_no_delete;
CREATE TRIGGER memberships_no_delete BEFORE DELETE ON memberships WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER teams_no_delete;
CREATE TRIGGER teams_no_delete BEFORE DELETE ON teams WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
DROP TRIGGER agents_no_delete;
CREATE TRIGGER agents_no_delete BEFORE DELETE ON agents WHEN NOT (EXISTS (SELECT 1 FROM beeteam_seed_cleanup) AND json_extract(OLD.data,'$.onboardingSeedVersion') IS OLD.version AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL) BEGIN SELECT RAISE(ABORT,'Physical deletion is disabled'); END;
