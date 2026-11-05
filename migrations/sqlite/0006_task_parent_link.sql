-- Keep board and author immutable, but allow service-owned hierarchy changes.
DROP TRIGGER tasks_immutable_structure;
CREATE TRIGGER tasks_immutable_structure BEFORE UPDATE OF data ON tasks
WHEN NEW.board_id IS NOT OLD.board_id OR NEW.author_agent_id IS NOT OLD.author_agent_id
BEGIN SELECT RAISE(ABORT,'Task board and author are immutable'); END;

CREATE TRIGGER task_hierarchy_cycle_insert BEFORE INSERT ON tasks
WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT CASE WHEN NEW.parent_id=NEW.id OR EXISTS(
  WITH RECURSIVE ancestors(id,parent_id) AS (
   SELECT id,parent_id FROM tasks WHERE id=NEW.parent_id
   UNION SELECT t.id,t.parent_id FROM tasks t JOIN ancestors a ON t.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE id=NEW.id
 ) THEN RAISE(ABORT,'Cycle in task hierarchy') END;
END;
CREATE TRIGGER task_hierarchy_cycle_update BEFORE UPDATE OF data ON tasks
WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT CASE WHEN NEW.parent_id=NEW.id OR EXISTS(
  WITH RECURSIVE ancestors(id,parent_id) AS (
   SELECT id,parent_id FROM tasks WHERE id=NEW.parent_id
   UNION SELECT t.id,t.parent_id FROM tasks t JOIN ancestors a ON t.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE id=NEW.id
 ) THEN RAISE(ABORT,'Cycle in task hierarchy') END;
END;
