/**
 * Alert Engine — background job that runs every 30 seconds.
 *
 * For each active alert rule it checks the project tables, inserts into
 * alert_history AND sends a Microsoft Teams adaptive card when triggered.
 *
 * Alert Types:
 *  - High Failure  : COUNT of errors in the last window_minutes exceeds threshold
 *  - New Error     : any row with error_status = 'open' inserted in the last poll window
 *  - Regression    : any row with error_status = 'reopened' inserted in the last poll window
 */
import { Pool } from 'pg';
export declare function startAlertEngine(pool: Pool): Promise<void>;
/**
 * Single-shot alert check — safe to call from a Lambda handler.
 * Use this instead of startAlertEngine() in Lambda, where setInterval
 * does not persist between invocations.
 *
 * Wire up an EventBridge scheduled rule (rate: 30 seconds) to invoke
 * the `alertHandler` export in lambda.ts, which calls this function.
 */
export declare function runAlertCheckOnce(pool: Pool): Promise<void>;
