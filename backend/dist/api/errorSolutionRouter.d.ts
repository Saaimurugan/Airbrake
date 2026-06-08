/**
 * Error Solutions Router
 * GET  /api/error-solution/:error_hash  — fetch solution for an error
 * POST /api/error-solution              — save/update solution
 * DELETE /api/error-solution/:error_hash — delete solution
 *
 * Only touches error_solutions table. Does NOT modify project tables,
 * alert_rules, or alert_history.
 */
import { Pool } from 'pg';
export declare function createErrorSolutionRouter(pool: Pool): any;
