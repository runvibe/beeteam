-- Allow explicit transactional hierarchy changes; retain immutable ownership.
CREATE OR REPLACE FUNCTION beeteam_task_structure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_data jsonb; BEGIN
  IF TG_OP='UPDATE' AND (NEW.data->'boardId' IS DISTINCT FROM OLD.data->'boardId' OR NEW.data->'authorAgentId' IS DISTINCT FROM OLD.data->'authorAgentId') THEN
    RAISE EXCEPTION 'Task board and author are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.data->>'parentId' IS NULL THEN
    IF NEW.data->>'rootTaskId' IS DISTINCT FROM NEW.id::text OR NEW.data->>'originBoardId' IS DISTINCT FROM NEW.data->>'boardId' THEN
      RAISE EXCEPTION 'Invalid root execution context' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS(WITH RECURSIVE ancestors AS (
      SELECT id,parent_id FROM tasks WHERE id=(NEW.data->>'parentId')::uuid
      UNION SELECT t.id,t.parent_id FROM tasks t JOIN ancestors a ON t.id=a.parent_id
    ) SELECT 1 FROM ancestors WHERE id=NEW.id) OR NEW.data->>'parentId'=NEW.id::text THEN
      RAISE EXCEPTION 'Cycle in task hierarchy' USING ERRCODE='23514';
    END IF;
    SELECT data INTO parent_data FROM tasks WHERE id=(NEW.data->>'parentId')::uuid;
    IF parent_data IS NULL OR NEW.data->>'rootTaskId' IS DISTINCT FROM parent_data->>'rootTaskId' OR NEW.data->>'originBoardId' IS DISTINCT FROM parent_data->>'originBoardId' THEN
      RAISE EXCEPTION 'Invalid parent execution context' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
