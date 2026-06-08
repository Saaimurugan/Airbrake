"use strict";
/**
 * Dashboard Aggregation REST API Router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetDashboardHandler = createGetDashboardHandler;
exports.createDashboardRouter = createDashboardRouter;
exports.createDashboardRouterSync = createDashboardRouterSync;
const rbac_1 = require("../auth/rbac");
// ─── Handler Factory ──────────────────────────────────────────────────────────
/**
 * GET /dashboard — returns aggregated metrics.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
function createGetDashboardHandler(repo) {
    return async (req, res) => {
        const granularity = req.query['granularity'] === 'daily' ? 'daily' : 'hourly';
        const now = new Date();
        const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const from = req.query['from'] ? new Date(req.query['from']) : defaultFrom;
        const to = req.query['to'] ? new Date(req.query['to']) : now;
        const [breakCount24h, breakCount7d, errorRateTrend, topServices, timeSeries, severityBreakdown,] = await Promise.all([
            repo.countBreaks(24),
            repo.countBreaks(7 * 24),
            repo.getErrorRateTrend(24, 1),
            repo.getTopServices(10),
            repo.getTimeSeries(granularity, from, to),
            repo.getSeverityBreakdown(),
        ]);
        const deploymentEvents = typeof repo.getDeploymentEvents === 'function'
            ? await repo.getDeploymentEvents()
            : [];
        res.json({
            breakCount24h,
            breakCount7d,
            errorRateTrend,
            topServices,
            timeSeries,
            severityBreakdown,
            deploymentEvents,
        });
    };
}
// ─── Router Factory ───────────────────────────────────────────────────────────
async function createDashboardRouter(dashboardRepo, sessionStore, auditLogRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.get('/', createGetDashboardHandler(dashboardRepo));
    return router;
}
function createDashboardRouterSync(dashboardRepo, sessionStore, auditLogRepo, rbacMiddleware) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.get('/', createGetDashboardHandler(dashboardRepo));
    return router;
}
//# sourceMappingURL=dashboardRouter.js.map