CREATE FUNCTION beeteam_role_invariants() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id
    WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL AND m.agent_id=t.leader_id
  ) THEN
    RAISE EXCEPTION 'Agent cannot lead and collaborate in the same team' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER membership_role_invariants AFTER INSERT OR UPDATE ON memberships
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beeteam_role_invariants();
CREATE CONSTRAINT TRIGGER team_role_invariants AFTER INSERT OR UPDATE ON teams
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beeteam_role_invariants();
