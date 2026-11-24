CREATE UNIQUE INDEX agents_system_key ON agents((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;

-- Portable restore may remove untouched onboarding seed rows (data.onboardingSeedVersion = version)
-- only after SET LOCAL beeteam.seed_cleanup='on' inside its own transaction.
CREATE FUNCTION beeteam_reject_delete_except_seed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('beeteam.seed_cleanup', true) = 'on'
     AND OLD.data->'onboardingSeedVersion' = to_jsonb(OLD.version)
     AND OLD.archived_at IS NULL AND OLD.deleted_at IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Physical deletion is disabled; set deleted_at instead' USING ERRCODE='23514';
END $$;
DROP TRIGGER reject_physical_delete ON events;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON events FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON tasks;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON statuses;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON statuses FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON boards;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON boards FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON memberships;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON memberships FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON teams;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON teams FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
DROP TRIGGER reject_physical_delete ON agents;
CREATE TRIGGER reject_physical_delete BEFORE DELETE ON agents FOR EACH ROW EXECUTE FUNCTION beeteam_reject_delete_except_seed();
