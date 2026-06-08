"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAlertEngine = startAlertEngine;
exports.runAlertCheckOnce = runAlertCheckOnce;
const teamsNotifier_1 = require("./teamsNotifier");
const POLL_INTERVAL_MS = 30000; // 30 seconds
// key: `${ruleId}:${projectName}:${errorMsg}` → last triggered timestamp
// NOTE (Lambda): this Map is module-level and survives across invocations within
// the same warm execution environment, but resets on cold starts.
// The DB-level dedup in insertHistory() is the authoritative guard — this Map
// only provides a lightweight in-memory fast-path to skip duplicate DB writes
// within a single warm instance.
const lastFired = new Map();
// Cooldown — same rule+project+error won't fire again within 1 minute
const COOLDOWN_MS = 60000;
// ─── Project table discovery ──────────────────────────────────────────────────
async function getProjectTables(pool) {
    // Graceful fallback if migration 033 (is_live) hasn't run yet
    const { rows: colCheck } = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'is_live'
    ) AS exists
  `);
    const hasIsLive = colCheck[0]?.exists === true;
    const liveFilter = hasIsLive
        ? `AND REPLACE(c.table_name, '_', ' ') IN (SELECT name FROM projects WHERE is_live = true)`
        : `AND c.table_name IN (
        'tand_f_rubriq_processing',
        'language_quality_score'
      )`;
    const { rows } = await pool.query(`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'project_name'
      AND c.table_name NOT IN (
        'alert_rules', 'alert_history', 'users', 'projects',
        'saved_filters', 'retention_policies', 'parse_errors',
        'audit_log', 'break_groups', 'breaks', 'error_solutions',
        'Image_Forensics'
      )
      AND c.table_name IN (
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'error_status'
      )
      ${liveFilter}
    ORDER BY c.table_name
  `);
    return rows.map((r) => r.table_name);
}
// ─── Alert history insert (with DB-level dedup) ───────────────────────────────
async function insertHistory(pool, ruleId, projectName, error, alertType) {
    // Don't insert if same rule+project+error fired within last 1 minute
    const { rows: existing } = await pool.query(`SELECT id FROM alert_history
     WHERE rule_id = $1 AND project_name = $2 AND error = $3
       AND triggered_at >= NOW() - INTERVAL '1 minute'
     LIMIT 1`, [ruleId, projectName, error]);
    if (existing.length > 0)
        return false; // already recorded — skip
    await pool.query('INSERT INTO alert_history (rule_id, project_name, error, alert_type) VALUES ($1, $2, $3, $4)', [ruleId, projectName, error, alertType]);
    return true; // newly inserted
}
function shouldFire(key) {
    const last = lastFired.get(key);
    return !last || Date.now() - last > COOLDOWN_MS;
}
function markFired(key) {
    lastFired.set(key, Date.now());
}
// ─── Main alert check loop ────────────────────────────────────────────────────
async function runAlertCheck(pool) {
    try {
        const { rows: rules } = await pool.query(`SELECT id, rule_name, project_name, alert_type, threshold, window_minutes
       FROM alert_rules WHERE is_active = true`);
        if (rules.length === 0)
            return;
        const tables = await getProjectTables(pool);
        if (tables.length === 0)
            return;
        for (const rule of rules) {
            const ruleId = rule.id;
            const ruleName = rule.rule_name;
            const alertType = rule.alert_type;
            const ruleProject = rule.project_name;
            const targetTables = ruleProject
                ? tables.filter(t => t.toLowerCase() === ruleProject.toLowerCase().replace(/ /g, '_') ||
                    t.toLowerCase().replace(/_/g, ' ') === ruleProject.toLowerCase())
                : tables;
            if (targetTables.length === 0) {
                if (ruleProject) {
                    const warnKey = `warn:${ruleId}`;
                    if (!lastFired.has(warnKey)) {
                        console.log(`[AlertEngine] no table for project="${ruleProject}" rule="${ruleName}" — skipping`);
                        lastFired.set(warnKey, Date.now());
                    }
                }
                continue;
            }
            // ── High Failure ────────────────────────────────────────────────────
            if (alertType === 'High Failure') {
                const threshold = rule.threshold ?? 5;
                const windowMinutes = rule.window_minutes ?? 5;
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT project_name, error, COUNT(*) AS cnt
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status IN ('open', 'reopened')
                 AND timestamp >= NOW() - INTERVAL '${windowMinutes} minutes'
               GROUP BY project_name, error
               HAVING COUNT(*) >= $1`, [threshold]);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            if (!shouldFire(key))
                                continue;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                console.log(`[AlertEngine] 🔥 High Failure → rule="${ruleName}" project="${row.project_name}" count=${row.cnt}`);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error, count: Number(row.cnt) });
                            }
                        }
                    }
                    catch { /* table may lack expected columns — skip */ }
                }
                // ── New Error ───────────────────────────────────────────────────────
            }
            else if (alertType === 'New Error') {
                const sinceSeconds = Math.ceil(POLL_INTERVAL_MS / 1000);
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'open'
                 AND timestamp >= NOW() - INTERVAL '${sinceSeconds} seconds'`);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            if (!shouldFire(key))
                                continue;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                console.log(`[AlertEngine] 🆕 New Error → rule="${ruleName}" project="${row.project_name}"`);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error });
                            }
                        }
                    }
                    catch { /* skip */ }
                }
                // ── Regression ──────────────────────────────────────────────────────
            }
            else if (alertType === 'Regression') {
                const sinceSeconds = Math.ceil(POLL_INTERVAL_MS / 1000);
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'reopened'
                 AND reopened_at >= NOW() - INTERVAL '${sinceSeconds} seconds'`);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            if (!shouldFire(key))
                                continue;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                console.log(`[AlertEngine] 🔄 Regression → rule="${ruleName}" project="${row.project_name}"`);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error });
                            }
                        }
                    }
                    catch { /* skip */ }
                }
            }
        }
    }
    catch (err) {
        console.error('[AlertEngine] check failed:', err);
    }
}
// ─── Startup backfill ─────────────────────────────────────────────────────────
async function runBackfill(pool) {
    console.log('[AlertEngine] running startup backfill (24h window)…');
    try {
        const { rows: rules } = await pool.query(`SELECT id, rule_name, project_name, alert_type, threshold, window_minutes
       FROM alert_rules WHERE is_active = true`);
        if (rules.length === 0) {
            console.log('[AlertEngine] no active rules — skipping backfill');
            return;
        }
        const tables = await getProjectTables(pool);
        if (tables.length === 0)
            return;
        for (const rule of rules) {
            const ruleId = rule.id;
            const ruleName = rule.rule_name;
            const alertType = rule.alert_type;
            const ruleProject = rule.project_name;
            const targetTables = ruleProject
                ? tables.filter(t => t.toLowerCase() === ruleProject.toLowerCase().replace(/ /g, '_'))
                : tables;
            if (targetTables.length === 0)
                continue;
            if (alertType === 'High Failure') {
                const threshold = rule.threshold ?? 5;
                const windowMinutes = rule.window_minutes ?? 5;
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT project_name, error, COUNT(*) AS cnt
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status IN ('open', 'reopened')
                 AND timestamp >= NOW() - INTERVAL '${windowMinutes} minutes'
               GROUP BY project_name, error
               HAVING COUNT(*) >= $1`, [threshold]);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error, count: Number(row.cnt) });
                            }
                        }
                    }
                    catch { /* skip */ }
                }
            }
            else if (alertType === 'New Error') {
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'open'
                 AND timestamp >= NOW() - INTERVAL '24 hours'`);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error });
                            }
                        }
                    }
                    catch { /* skip */ }
                }
            }
            else if (alertType === 'Regression') {
                for (const table of targetTables) {
                    try {
                        const { rows } = await pool.query(`SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'reopened'
                 AND reopened_at >= NOW() - INTERVAL '24 hours'`);
                        for (const row of rows) {
                            const key = `${ruleId}:${row.project_name}:${row.error}`;
                            const inserted = await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
                            if (inserted) {
                                markFired(key);
                                await (0, teamsNotifier_1.sendTeamsAlert)({ ruleName, alertType, projectName: row.project_name, errorMsg: row.error });
                            }
                        }
                    }
                    catch { /* skip */ }
                }
            }
        }
        console.log('[AlertEngine] backfill complete');
    }
    catch (err) {
        console.error('[AlertEngine] backfill failed:', err);
    }
}
// ─── Entry point ──────────────────────────────────────────────────────────────
async function startAlertEngine(pool) {
    console.log('[AlertEngine] starting — poll interval:', POLL_INTERVAL_MS / 1000, 's');
    try {
        const tables = await getProjectTables(pool);
        console.log('[AlertEngine] discovered tables:', tables.length);
        const { rows: rules } = await pool.query(`SELECT id, rule_name, project_name, alert_type, threshold, window_minutes
       FROM alert_rules WHERE is_active = true`);
        console.log('[AlertEngine] active rules:', rules.map(r => `${r.rule_name}(${r.alert_type}, project="${r.project_name}", threshold=${r.threshold}, window=${r.window_minutes}min)`));
    }
    catch (e) {
        console.error('[AlertEngine] startup check failed:', e);
    }
    await runBackfill(pool);
    setInterval(() => runAlertCheck(pool), POLL_INTERVAL_MS);
}
/**
 * Single-shot alert check — safe to call from a Lambda handler.
 * Use this instead of startAlertEngine() in Lambda, where setInterval
 * does not persist between invocations.
 *
 * Wire up an EventBridge scheduled rule (rate: 30 seconds) to invoke
 * the `alertHandler` export in lambda.ts, which calls this function.
 */
async function runAlertCheckOnce(pool) {
    await runAlertCheck(pool);
}
//# sourceMappingURL=alertChecker.js.map