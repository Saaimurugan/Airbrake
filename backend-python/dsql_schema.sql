-- ═══════════════════════════════════════════════════════════════════════════════
-- DSQL Single-Table Architecture: projects_data
--
-- ONE table for ALL data, differentiated by `row_type`:
--
--   'project'   → project registry
--   'log'       → file processing results (success + errors)
--   'solution'  → AI knowledge base (solution versioning)
--   'user'      → user accounts
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects_data (

    -- ── every row ────────────────────────────────────────────────────────────
    id              TEXT          NOT NULL,
    row_type        TEXT          NOT NULL,
    project_name    TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    timestamp       TIMESTAMPTZ   DEFAULT NOW(),

    -- ── project ──────────────────────────────────────────────────────────────
    category        TEXT,
    is_live         BOOLEAN       DEFAULT true,

    -- ── log ──────────────────────────────────────────────────────────────────
    file_name       TEXT,
    success_count   INTEGER       DEFAULT 0,
    failure_count   INTEGER       DEFAULT 0,
    error           TEXT,
    error_detail    TEXT,
    error_hash      TEXT,
    error_status    TEXT,
    resolved_at     TIMESTAMPTZ,
    reopened_at     TIMESTAMPTZ,
    word_count      INTEGER,
    file_type       TEXT,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    calculated_cost NUMERIC(14,6),
    llm_usage       TEXT,

    -- ── solution (AI knowledge base) ─────────────────────────────────────────
    solution        TEXT,
    created_by      TEXT,
    usage_count     INTEGER       DEFAULT 1,
    version         INTEGER       DEFAULT 1,
    confidence_score NUMERIC(6,2) DEFAULT 50.0,
    log_ref_id      TEXT,
    embedding       FLOAT[],

    -- ── user ─────────────────────────────────────────────────────────────────
    email           TEXT,
    role            TEXT,
    oauth_provider  TEXT,
    oauth_subject   TEXT
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_pd_solution_confidence
    ON projects_data (confidence_score DESC, usage_count DESC)
    WHERE row_type = 'solution';
