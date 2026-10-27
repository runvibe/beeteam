-- PostgreSQL CHECK accepts NULL. uuid_extract_version returns NULL for non-RFC
-- variants, so explicitly require TRUE rather than relying on equality alone.
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['agents','teams','memberships','boards','statuses','tasks','plans','plan_revisions','comments','attachments','execution_summaries','events','chat_references','images','file_contents','request_replays','board_events'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT strict_uuidv7 CHECK ((uuid_extract_version(id)=7) IS TRUE)',tab);
  END LOOP;
  -- Existing template records are retained; never rewrite their identities.
  FOREACH tab IN ARRAY ARRAY['authors','posts'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT strict_uuidv7 CHECK ((uuid_extract_version(id)=7) IS TRUE) NOT VALID',tab);
  END LOOP;
END $$;
