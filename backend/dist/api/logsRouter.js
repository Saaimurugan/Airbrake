"use strict";
/**
 * Logs REST API Router
 * Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.5, 9.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCsv = toCsv;
exports.createSearchLogsHandler = createSearchLogsHandler;
exports.createExportLogsHandler = createExportLogsHandler;
exports.createExportBreaksHandler = createExportBreaksHandler;
exports.createLogsRouter = createLogsRouter;
exports.createLogsRouterSync = createLogsRouterSync;
const rbac_1 = require("../auth/rbac");
// ─── CSV Helper ───────────────────────────────────────────────────────────────
/**
 * Minimal CSV serializer.
 * Produces a header row followed by one row per record.
 */
function toCsv(records, fields) {
    const escape = (val) => {
        if (val === null || val === undefined)
            return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Wrap in quotes if the value contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const header = fields.join(',');
    const rows = records.map((rec) => fields.map((f) => escape(rec[f])).join(','));
    return [header, ...rows].join('\n');
}
// ─── Handler Factories ────────────────────────────────────────────────────────
const LOG_CSV_FIELDS = [
    'id', 'applicationId', 'environment', 'severity', 'message', 'timestamp', 'tags',
];
const BREAK_CSV_FIELDS = [
    'id', 'applicationId', 'environment', 'severity', 'errorMessage', 'stackTrace',
    'endpoint', 'timestamp', 'fingerprint',
];
/**
 * GET /logs — paginated, filterable log search.
 * Requirements: 1.4, 1.5, 8.1, 8.2
 */
function createSearchLogsHandler(logRepo) {
    return async (req, res) => {
        const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
        const tagsRaw = req.query['tags'];
        const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
        const filters = {
            page,
            limit,
            keyword: req.query['keyword'],
            tags,
            severity: req.query['severity'],
            applicationId: req.query['applicationId'],
            environment: req.query['environment'],
            from: req.query['from'] ? new Date(req.query['from']) : undefined,
            to: req.query['to'] ? new Date(req.query['to']) : undefined,
        };
        const { data, total } = await logRepo.search(filters);
        res.json({ data, total, page, limit });
    };
}
/**
 * GET /logs/export — export all matching logs as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
function createExportLogsHandler(logRepo) {
    return async (req, res) => {
        const format = req.query['format'] ?? 'json';
        const tagsRaw = req.query['tags'];
        const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
        const filters = {
            keyword: req.query['keyword'],
            tags,
            severity: req.query['severity'],
            applicationId: req.query['applicationId'],
            environment: req.query['environment'],
            from: req.query['from'] ? new Date(req.query['from']) : undefined,
            to: req.query['to'] ? new Date(req.query['to']) : undefined,
        };
        const records = await logRepo.searchAll(filters);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
            res.send(toCsv(records, LOG_CSV_FIELDS));
        }
        else {
            res.json(records);
        }
    };
}
/**
 * GET /breaks/export — export all matching breaks as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
function createExportBreaksHandler(breakExportRepo) {
    return async (req, res) => {
        const format = req.query['format'] ?? 'json';
        const filters = {
            severity: req.query['severity'],
            applicationId: req.query['applicationId'],
            from: req.query['from'] ? new Date(req.query['from']) : undefined,
            to: req.query['to'] ? new Date(req.query['to']) : undefined,
        };
        const records = await breakExportRepo.exportAll(filters);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="breaks.csv"');
            res.send(toCsv(records, BREAK_CSV_FIELDS));
        }
        else {
            res.json(records);
        }
    };
}
// ─── Router Factory (Express wiring) ─────────────────────────────────────────
/**
 * Creates an Express Router for /logs endpoints with RBAC applied.
 */
async function createLogsRouter(logRepo, breakExportRepo, sessionStore, auditLogRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.get('/export', createExportLogsHandler(logRepo));
    router.get('/', createSearchLogsHandler(logRepo));
    return router;
}
/**
 * Synchronous version for use when express is already loaded.
 */
function createLogsRouterSync(logRepo, breakExportRepo, sessionStore, auditLogRepo, rbacMiddleware) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.get('/export', createExportLogsHandler(logRepo));
    router.get('/', createSearchLogsHandler(logRepo));
    return router;
}
//# sourceMappingURL=logsRouter.js.map