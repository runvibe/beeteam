SELECT pg_advisory_xact_lock(1884347301); -- Same lock order as running application transactions.
-- One shared normalizer for new entities and deterministic historical backfill.
CREATE FUNCTION beeteam_slug_base(label text, fallback text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE base text;
BEGIN
  base := lower(normalize(label, NFKD));
  base := replace(replace(replace(base, 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe');
  base := regexp_replace(base, U&'[\0300-\036f]', '', 'g');
  base := trim(both '-' from regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
  IF base = '' THEN base := fallback; END IF;
  IF base = ANY(ARRAY['new','edit','create','by-slug','resolve','search','archive','settings','api','mcp','agents','teams','tasks'])
     OR base ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN base := fallback || '-' || base; END IF;
  RETURN trim(trailing '-' from left(base,80));
END $$;

ALTER TABLE agents ADD COLUMN slug text GENERATED ALWAYS AS (data->>'slug') STORED;
ALTER TABLE teams ADD COLUMN slug text GENERATED ALWAYS AS (data->>'slug') STORED;
ALTER TABLE tasks ADD COLUMN slug text GENERATED ALWAYS AS (data->>'slug') STORED;
-- No deleted_at predicate: retired links must never point to a new identity.
CREATE UNIQUE INDEX agents_slug_unique ON agents(slug);
CREATE UNIQUE INDEX teams_slug_unique ON teams(slug);
CREATE UNIQUE INDEX tasks_slug_unique ON tasks(slug);

CREATE FUNCTION beeteam_allocate_slug(entity text, label text) RETURNS text
LANGUAGE plpgsql VOLATILE STRICT AS $$
DECLARE base text; candidate text; suffix text; number bigint := 1; taken boolean;
BEGIN
  IF entity NOT IN ('agents','teams','tasks') THEN RAISE EXCEPTION 'Unsupported slug entity'; END IF;
  PERFORM pg_advisory_xact_lock(1884347301);
  base := beeteam_slug_base(label, left(entity,length(entity)-1));
  candidate := base;
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE slug=$1)',entity) INTO taken USING candidate;
    IF NOT taken THEN RETURN candidate; END IF;
    number := number+1;
    suffix := '-' || number::text;
    candidate := trim(trailing '-' from left(base,80-length(suffix))) || suffix;
  END LOOP;
END $$;

DO $$ DECLARE entity text; row record; label_key text; allocated text; BEGIN
  PERFORM pg_advisory_xact_lock(1884347301);
  FOREACH entity IN ARRAY ARRAY['agents','teams','tasks'] LOOP
    label_key := CASE WHEN entity='tasks' THEN 'title' ELSE 'name' END;
    FOR row IN EXECUTE format('SELECT id,data FROM %I ORDER BY created_at,id',entity) LOOP
      allocated := beeteam_allocate_slug(entity,coalesce(row.data->>label_key,''));
      EXECUTE format('UPDATE %I SET data=jsonb_set(data,''{slug}'',to_jsonb($1::text)) WHERE id=$2',entity) USING allocated,row.id;
    END LOOP;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN slug SET NOT NULL',entity);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT valid_slug CHECK (length(slug) BETWEEN 1 AND 80 AND slug ~ ''^[a-z0-9]+(-[a-z0-9]+)*$'')',entity);
  END LOOP;
END $$;

CREATE FUNCTION beeteam_preserve_slug() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.data->>'slug' IS DISTINCT FROM NEW.data->>'slug' THEN
    RAISE EXCEPTION 'Slugs are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agents_preserve_slug BEFORE UPDATE OF data ON agents FOR EACH ROW EXECUTE FUNCTION beeteam_preserve_slug();
CREATE TRIGGER teams_preserve_slug BEFORE UPDATE OF data ON teams FOR EACH ROW EXECUTE FUNCTION beeteam_preserve_slug();
CREATE TRIGGER tasks_preserve_slug BEFORE UPDATE OF data ON tasks FOR EACH ROW EXECUTE FUNCTION beeteam_preserve_slug();
