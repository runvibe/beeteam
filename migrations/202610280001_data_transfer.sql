CREATE TABLE beeteam_installation (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), id uuid NOT NULL UNIQUE CHECK(uuid_extract_version(id)=7));
CREATE TABLE beeteam_restore_markers (job_id uuid PRIMARY KEY, archive_sha256 text NOT NULL, committed_at timestamptz NOT NULL DEFAULT now());
