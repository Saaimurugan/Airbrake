"use strict";
/**
 * Breaks REST API Router
 * Requirements: 2.1, 4.1, 4.2, 4.3, 4.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createListBreaksHandler = createListBreaksHandler;
exports.createGetBreakHandler = createGetBreakHandler;
exports.createBreaksRouter = createBreaksRouter;
exports.createBreaksRouterSync = createBreaksRouterSync;
const rbac_1 = require("../auth/rbac");
const logsRouter_1 = require("./logsRouter");
// ─── Handler Factories ────────────────────────────────────────────────────────
/**
 * GET /breaks — paginated, filterable list.
 * Requirements: 2.1, 4.3
 */
function createListBreaksHandler(breakRepo) {
    return async (req, res) => {
        const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
        const filters = {
            page,
            limit,
            status: req.query['status'],
            severity: req.query['severity'],
            applicationId: req.query['applicationId'],
            from: req.query['from'] ? new Date(req.query['from']) : undefined,
            to: req.query['to'] ? new Date(req.query['to']) : undefined,
        };
        const { data, total } = await breakRepo.findAll(filters);
        res.json({ data, total, page, limit });
    };
}
/**
 * GET /breaks/:id — detail with correlated logs.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
function createGetBreakHandler(breakRepo, logRepo) {
    return async (req, res) => {
        const { id } = req.params;
        const breakRecord = await breakRepo.findById(id);
        if (!breakRecord) {
            res.status(404).json({ error: 'Not Found', message: 'Break not found.' });
            return;
        }
        // Correlated logs: same applicationId, timestamp within ±5 minutes (Requirement 4.2)
        const FIVE_MINUTES_MS = 5 * 60 * 1000;
        const breakTime = new Date(breakRecord.timestamp).getTime();
        const from = new Date(breakTime - FIVE_MINUTES_MS);
        const to = new Date(breakTime + FIVE_MINUTES_MS);
        const correlatedLogs = await logRepo.findCorrelated(breakRecord.applicationId, from, to);
        res.json({ ...breakRecord, correlatedLogs });
    };
}
// ─── Router Factory (Express wiring) ─────────────────────────────────────────
/**
 * Creates an Express Router with RBAC applied to all breaks endpoints.
 * Lazily imports express so the module can be tested without express installed.
 */
async function createBreaksRouter(breakRepo, logRepo, sessionStore, auditLogRepo, breakExportRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    if (breakExportRepo) {
        router.get('/export', (0, logsRouter_1.createExportBreaksHandler)(breakExportRepo));
    }
    router.get('/', createListBreaksHandler(breakRepo));
    router.get('/:id', createGetBreakHandler(breakRepo, logRepo));
    return router;
}
/**
 * Synchronous version for use when express is already loaded.
 */
function createBreaksRouterSync(breakRepo, logRepo, sessionStore, auditLogRepo, rbacMiddleware, breakExportRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    if (breakExportRepo) {
        router.get('/export', (0, logsRouter_1.createExportBreaksHandler)(breakExportRepo));
    }
    router.get('/', createListBreaksHandler(breakRepo));
    router.get('/:id', createGetBreakHandler(breakRepo, logRepo));
    return router;
}
//# sourceMappingURL=breaksRouter.js.map