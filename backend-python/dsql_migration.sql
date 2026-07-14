-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Copy all existing data into projects_data
-- Run AFTER dsql_schema.sql has been executed.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── STEP 1: Projects ─────────────────────────────────────────────────────────
INSERT INTO projects_data (id, row_type, project_name, category, is_live, created_at)
SELECT id::TEXT, 'project', name, COALESCE(category, 'Production'),
       COALESCE(is_live, true), COALESCE(created_at, NOW())
FROM projects
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 2: Logs / Results ───────────────────────────────────────────────────
INSERT INTO projects_data (
    id, row_type, project_name, file_name, timestamp,
    success_count, failure_count,
    error, error_detail, error_hash, error_status,
    resolved_at, reopened_at,
    word_count, file_type,
    input_tokens, output_tokens, calculated_cost, llm_usage
)
SELECT id::TEXT, 'log', project_name, file_name, COALESCE(timestamp, NOW()),
       COALESCE(success_count, 0), COALESCE(failure_count, 0),
       error, error_detail, error_hash, error_status,
       resolved_at, reopened_at, word_count, file_type,
       input_tokens, output_tokens, calculated_cost, llm_usage
FROM project_results
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 3: Users ────────────────────────────────────────────────────────────
INSERT INTO projects_data (id, row_type, email, role, oauth_provider, oauth_subject, created_at)
SELECT id::TEXT, 'user', email, role, oauth_provider, oauth_subject, COALESCE(created_at, NOW())
FROM users
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 4: Solutions (from old error_solutions table) ──────────────────────
INSERT INTO projects_data (
    id, row_type, project_name, error_hash, log_ref_id,
    solution, created_by, created_at, usage_count, version, confidence_score
)
SELECT
    gen_random_uuid()::TEXT, 'solution',
    pd.project_name, es.error_hash, pd.id,
    es.solution, 'migrated', COALESCE(es.updated_at, NOW()),
    1, 1, 50.0
FROM error_solutions es
JOIN projects_data pd
    ON pd.row_type = 'log' AND pd.error_hash = es.error_hash
    AND pd.id = (
        SELECT id FROM projects_data
        WHERE row_type = 'log' AND error_hash = es.error_hash
        ORDER BY timestamp DESC LIMIT 1
    )
WHERE es.solution IS NOT NULL AND es.solution <> ''
ON CONFLICT DO NOTHING;

-- ─── VERIFY ───────────────────────────────────────────────────────────────────
SELECT row_type, COUNT(*) AS total
FROM projects_data
GROUP BY row_type
ORDER BY row_type;
