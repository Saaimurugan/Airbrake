-- ═══════════════════════════════════════════════════════════════════════════════
-- ALTER TABLE: Add missing columns to existing projects_data table
--
-- Run this if projects_data already exists but is missing columns.
-- All statements use IF NOT EXISTS equivalent (ADD COLUMN IF NOT EXISTS).
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Core ─────────────────────────────────────────────────────────────────────
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS timestamp       TIMESTAMPTZ   DEFAULT NOW();

-- ── project ──────────────────────────────────────────────────────────────────
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS is_live         BOOLEAN       DEFAULT true;

-- ── log ──────────────────────────────────────────────────────────────────────
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS file_name       TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS success_count   INTEGER       DEFAULT 0;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS failure_count   INTEGER       DEFAULT 0;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS error           TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS error_detail    TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS error_hash      TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS error_status    TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS reopened_at     TIMESTAMPTZ;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS word_count      INTEGER;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS file_type       TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS input_tokens    INTEGER;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS output_tokens   INTEGER;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS calculated_cost NUMERIC(14,6);
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS llm_usage       TEXT;

-- ── solution ─────────────────────────────────────────────────────────────────
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS solution        TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS created_by      TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS usage_count     INTEGER       DEFAULT 1;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS version         INTEGER       DEFAULT 1;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(6,2) DEFAULT 50.0;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS log_ref_id      TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS embedding       FLOAT[];

-- ── user ─────────────────────────────────────────────────────────────────────
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS role            TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS oauth_provider  TEXT;
ALTER TABLE projects_data ADD COLUMN IF NOT EXISTS oauth_subject   TEXT;

-- ── Indexes (safe to re-run) ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pd_row_type
    ON projects_data (row_type);

CREATE INDEX IF NOT EXISTS idx_pd_project_name
    ON projects_data (row_type, LOWER(project_name));

CREATE INDEX IF NOT EXISTS idx_pd_log_timestamp
    ON projects_data (project_name, timestamp DESC)
    WHERE row_type = 'log';

CREATE INDEX IF NOT EXISTS idx_pd_error_hash
    ON projects_data (error_hash)
    WHERE row_type = 'log' AND error_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pd_open_errors
    ON projects_data (project_name, timestamp DESC)
    WHERE row_type = 'log'
      AND error IS NOT NULL
      AND error <> ''
      AND error_status IN ('open', 'reopened');

CREATE INDEX IF NOT EXISTS idx_pd_solution_log_ref
    ON projects_data (log_ref_id)
    WHERE row_type = 'solution';

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects_data'
ORDER BY ordinal_position;
