/**
 * Alert Management Router
 * Serves the alert_rules and alert_history tables directly.
 *
 * GET    /api/alert-rules              — list all rules
 * POST   /api/alert-rules              — create a rule (stored in DB)
 * PUT    /api/alert-rules/:id          — update a rule
 * DELETE /api/alert-rules/:id          — delete a rule
 * PATCH  /api/alert-rules/:id/toggle   — toggle is_active
 *
 * GET    /api/alert-history            — triggered alerts (?project=&alert_type=&from=&to=)
 */
import { Pool } from 'pg';
export declare function createAlertManagementRouter(pool: Pool): any;
