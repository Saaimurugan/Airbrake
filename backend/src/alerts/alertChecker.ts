/**
 * Alert Engine — background job that runs every 60 seconds.
 *
 * For each active alert rule it checks the project tables and inserts
 * into alert_history when a condition is met.
 *
 * Alert Types:
 *  - High Failure  : COUNT of errors in the last window_minutes exceeds threshold
 *  - New Error     : any row with error_status = 'open' inserted in the last run window
 *  - Regression    : any row with error_status = 'reopened' inserted in the last run window
 *
 * De-duplication: we track the last time each rule fired per project+error
 * using a simple in-memory map so we don't spam alert_history with duplicates
 * on every tick.
 */

import { Pool } from 'pg';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// key: `${ruleId}:${projectName}:${errorHash}` → last triggered timestamp
const lastFired = new Map<string, number>();

// How long before the same rule+project+error can fire again (1 minute)
const COOLDOWN_MS = 1 * 60_000;

async function getProjectTables(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string }>(`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'project_name'
      AND c.table_name NOT IN ('alert_rules', 'alert_history', 'users',
                               'projects', 'saved_filters', 'retention_policies',
                               'parse_errors', 'audit_log', 'break_groups', 'breaks')
      AND c.table_name != 'Image_Forensics'
      AND c.table_name IN (
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'error_status'
      )
    ORDER BY c.table_name
  `);
  return rows.map((r) => r.table_name);
}

async function insertHistory(
  pool: Pool,
  ruleId: string,
  projectName: string,
  error: string,
  alertType: string,
): Promise<void> {
  // DB-level dedup: don't insert if same rule+project+error fired within last 1 minute
  const { rows: existing } = await pool.query(
    `SELECT id FROM alert_history
     WHERE rule_id = $1 AND project_name = $2 AND error = $3
       AND triggered_at >= NOW() - INTERVAL '1 minute'
     LIMIT 1`,
    [ruleId, projectName, error],
  );
  if (existing.length > 0) return;

  await pool.query(
    'INSERT INTO alert_history (rule_id, project_name, error, alert_type) VALUES ($1, $2, $3, $4)',
    [ruleId, projectName, error, alertType],
  );
}

function shouldFire(key: string): boolean {
  const last = lastFired.get(key);
  if (!last) return true;
  return Date.now() - last > COOLDOWN_MS;
}

function markFired(key: string): void {
  lastFired.set(key, Date.now());
}

async function runAlertCheck(pool: Pool): Promise<void> {
  try {
    // Load all active rules
    const { rows: rules } = await pool.query(
      `SELECT id, rule_name, project_name, alert_type, threshold, window_minutes
       FROM alert_rules WHERE is_active = true`,
    );

    if (rules.length === 0) return;

    const tables = await getProjectTables(pool);
    if (tables.length === 0) return;

    for (const rule of rules) {
      const ruleId: string = rule.id;
      const alertType: string = rule.alert_type;
      const ruleProject: string | null = rule.project_name;

      // Match table to project: compare lowercased table name against lowercased project name
      // with spaces replaced by underscores (e.g. "AI QC" → "ai_qc" matches table "AI_QC")
      const targetTables = ruleProject
        ? tables.filter(t =>
            t.toLowerCase() === ruleProject.toLowerCase().replace(/ /g, '_') ||
            t.toLowerCase().replace(/_/g, ' ') === ruleProject.toLowerCase()
          )
        : tables;

      if (targetTables.length === 0) {
        if (ruleProject) console.log(`[AlertEngine] no table found for project="${ruleProject}" rule="${rule.rule_name}"`);
        continue;
      }

      if (alertType === 'High Failure') {
        const threshold: number = rule.threshold ?? 5;
        const windowMinutes: number = rule.window_minutes ?? 5;
        const windowInterval = `${windowMinutes} minutes`;

        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT project_name, error, COUNT(*) AS cnt
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status IN ('open', 'reopened')
                 AND timestamp >= NOW() - INTERVAL '${windowInterval}'
               GROUP BY project_name, error
               HAVING COUNT(*) >= $1`,
              [threshold],
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              if (!shouldFire(key)) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
              console.log(`[AlertEngine] High Failure fired: rule="${rule.rule_name}" project="${row.project_name}" count=${row.cnt}`);
            }
          } catch {
            // table may not have expected columns — skip silently
          }
        }

      } else if (alertType === 'New Error') {
        // Errors with error_status = 'open' seen in the last POLL_INTERVAL_MS window
        const sinceSeconds = Math.ceil(POLL_INTERVAL_MS / 1000);

        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'open'
                 AND timestamp >= NOW() - INTERVAL '${sinceSeconds} seconds'`,
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              if (!shouldFire(key)) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
              console.log(`[AlertEngine] New Error fired: rule="${rule.rule_name}" project="${row.project_name}"`);
            }
          } catch {
            // skip
          }
        }

      } else if (alertType === 'Regression') {
        // Errors with error_status = 'reopened' seen in the last POLL_INTERVAL_MS window
        const sinceSeconds = Math.ceil(POLL_INTERVAL_MS / 1000);

        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'reopened'
                 AND reopened_at >= NOW() - INTERVAL '${sinceSeconds} seconds'`,
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              if (!shouldFire(key)) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
              console.log(`[AlertEngine] Regression fired: rule="${rule.rule_name}" project="${row.project_name}"`);
            }
          } catch {
            // skip
          }
        }
      }
    }
  } catch (err) {
    console.error('[AlertEngine] check failed:', err);
  }
}

/**
 * Starts the alert engine polling loop.
 * Also runs an immediate backfill on startup so existing errors
 * in the DB are evaluated right away (not just new ones).
 */
export async function startAlertEngine(pool: Pool): Promise<void> {
  console.log('[AlertEngine] starting — poll interval:', POLL_INTERVAL_MS / 1000, 's');

  // Debug: log all discovered tables and active rules on startup
  try {
    const tables = await getProjectTables(pool);
    console.log('[AlertEngine] discovered tables:', tables.length, '— includes AI_QC:', tables.includes('AI_QC'));

    const { rows: rules } = await pool.query(
      `SELECT id, rule_name, project_name, alert_type, threshold, window_minutes FROM alert_rules WHERE is_active = true`,
    );
    console.log('[AlertEngine] active rules:', rules.map(r => `${r.rule_name}(${r.alert_type}, project="${r.project_name}", threshold=${r.threshold}, window=${r.window_minutes}min)`));

    // Debug: directly check AI_QC for matching rows
    const { rows: testRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM "AI_QC"
       WHERE error IS NOT NULL AND error <> ''
         AND error_status IN ('open','reopened')
         AND timestamp >= NOW() - INTERVAL '60 minutes'`,
    );
    console.log('[AlertEngine] AI_QC errors in last 60min:', testRows[0]?.cnt);
  } catch (e) {
    console.error('[AlertEngine] debug check failed:', e);
  }

  await runBackfill(pool);
  setInterval(() => runAlertCheck(pool), POLL_INTERVAL_MS);
}

/**
 * Backfill: runs once on startup with a 24-hour window so all existing
 * errors in the project tables are evaluated against active rules.
 * This populates alert_history from your existing data immediately.
 */
async function runBackfill(pool: Pool): Promise<void> {
  console.log('[AlertEngine] running startup backfill (24h window)…');
  try {
    const { rows: rules } = await pool.query(
      `SELECT id, rule_name, project_name, alert_type, threshold, window_minutes
       FROM alert_rules WHERE is_active = true`,
    );

    if (rules.length === 0) {
      console.log('[AlertEngine] no active rules — skipping backfill');
      return;
    }

    const tables = await getProjectTables(pool);
    if (tables.length === 0) return;

    for (const rule of rules) {
      const ruleId: string = rule.id;
      const alertType: string = rule.alert_type;
      const ruleProject: string | null = rule.project_name;

      const targetTables = ruleProject
        ? tables.filter(t => t.toLowerCase() === ruleProject.toLowerCase().replace(/ /g, '_'))
        : tables;

      if (targetTables.length === 0) continue;

      if (alertType === 'High Failure') {
        const threshold: number = rule.threshold ?? 5;
        const windowMinutes: number = rule.window_minutes ?? 5;

        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT project_name, error, COUNT(*) AS cnt
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status IN ('open', 'reopened')
                 AND timestamp >= NOW() - INTERVAL '${windowMinutes} minutes'
               GROUP BY project_name, error
               HAVING COUNT(*) >= $1`,
              [threshold],
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              // Check if already in alert_history to avoid duplicates on restart
              const { rows: existing } = await pool.query(
                `SELECT id FROM alert_history WHERE rule_id = $1 AND project_name = $2 AND error = $3
                 AND triggered_at >= NOW() - INTERVAL '${windowMinutes} minutes' LIMIT 1`,
                [ruleId, row.project_name, row.error],
              );
              if (existing.length > 0) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
            }
          } catch { /* skip */ }
        }

      } else if (alertType === 'New Error') {
        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'open'
                 AND timestamp >= NOW() - INTERVAL '24 hours'`,
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              const { rows: existing } = await pool.query(
                `SELECT id FROM alert_history WHERE rule_id = $1 AND project_name = $2 AND error = $3 LIMIT 1`,
                [ruleId, row.project_name, row.error],
              );
              if (existing.length > 0) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
            }
          } catch { /* skip */ }
        }

      } else if (alertType === 'Regression') {
        for (const table of targetTables) {
          try {
            const { rows } = await pool.query(
              `SELECT DISTINCT project_name, error
               FROM "${table}"
               WHERE error IS NOT NULL AND error <> ''
                 AND error_status = 'reopened'
                 AND reopened_at >= NOW() - INTERVAL '24 hours'`,
            );

            for (const row of rows) {
              const key = `${ruleId}:${row.project_name}:${row.error}`;
              const { rows: existing } = await pool.query(
                `SELECT id FROM alert_history WHERE rule_id = $1 AND project_name = $2 AND error = $3 LIMIT 1`,
                [ruleId, row.project_name, row.error],
              );
              if (existing.length > 0) continue;
              await insertHistory(pool, ruleId, row.project_name, row.error, alertType);
              markFired(key);
            }
          } catch { /* skip */ }
        }
      }
    }

    console.log('[AlertEngine] backfill complete');
  } catch (err) {
    console.error('[AlertEngine] backfill failed:', err);
  }
}
