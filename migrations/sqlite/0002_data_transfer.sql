CREATE TABLE beeteam_installation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), id TEXT NOT NULL UNIQUE);
CREATE TABLE beeteam_restore_markers (job_id TEXT PRIMARY KEY, archive_sha256 TEXT NOT NULL, committed_at TEXT NOT NULL);
