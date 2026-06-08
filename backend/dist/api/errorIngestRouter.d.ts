/**
 * Ingest Router
 *
 * Two endpoints:
 *
 * ── POST /api/ingest/error ────────────────────────────────────────────────────
 * Insert a FAILURE row. Sends Teams alert.
 * Required: project_name, error
 *
 * ── POST /api/ingest/log ──────────────────────────────────────────────────────
 * Insert ANY row — success OR error. No Teams alert for pure success rows.
 * Required: project_name
 * If "error" is provided → stored as failure (error_status = 'open'), Teams alert sent
 * If no "error"          → stored as success (error_status = null, success_count = 1)
 *
 * Common optional fields (both endpoints):
 *   file_name, error_detail, success_count, failure_count,
 *   word_count, file_type, input_tokens, output_tokens,
 *   calculated_cost, llm_usage
 *
 * ── Examples ──────────────────────────────────────────────────────────────────
 *
 * Success log:
 *   POST /api/ingest/log
 *   { "project_name": "AI QC", "file_name": "DH.pdf", "success_count": 1 }
 *
 * Error log:
 *   POST /api/ingest/log
 *   { "project_name": "AI QC", "file_name": "DH.pdf",
 *     "error": "RuntimeError: CUDA out of memory",
 *     "error_detail": "Traceback..." }
 *
 * Error only (original endpoint — unchanged):
 *   POST /api/ingest/error
 *   { "project_name": "AI QC", "file_name": "DH.pdf",
 *     "error": "RuntimeError: CUDA out of memory" }
 */
import { Pool } from 'pg';
export declare function createErrorIngestRouter(pool: Pool): any;
