"use strict";
/**
 * Alert Rules REST API Router
 * Requirements: 5.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlertRuleHandler = createAlertRuleHandler;
exports.listAlertRulesHandler = listAlertRulesHandler;
exports.updateAlertRuleHandler = updateAlertRuleHandler;
exports.deleteAlertRuleHandler = deleteAlertRuleHandler;
exports.createAlertsRouterSync = createAlertsRouterSync;
const rbac_1 = require("../auth/rbac");
// ─── Handler Factories ────────────────────────────────────────────────────────
/**
 * POST /alerts — create an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
function createAlertRuleHandler(repo) {
    return async (req, res) => {
        const body = req.body;
        const created = await repo.create(body);
        res.status(201).json(created);
    };
}
/**
 * GET /alerts — list all alert rules (Viewer+).
 * Requirements: 5.5
 */
function listAlertRulesHandler(repo) {
    return async (_req, res) => {
        const rules = await repo.findAll();
        res.status(200).json(rules);
    };
}
/**
 * PUT /alerts/:id — update an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
function updateAlertRuleHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const body = req.body;
        const updated = await repo.update(id, body);
        if (!updated) {
            res.status(404).json({ error: 'Not Found', message: 'Alert rule not found.' });
            return;
        }
        res.status(200).json(updated);
    };
}
/**
 * DELETE /alerts/:id — delete an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
function deleteAlertRuleHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const deleted = await repo.delete(id);
        if (!deleted) {
            res.status(404).json({ error: 'Not Found', message: 'Alert rule not found.' });
            return;
        }
        res.status(204).send();
    };
}
// ─── Router Factory ───────────────────────────────────────────────────────────
function createAlertsRouterSync(alertRepo, sessionStore, auditLogRepo, rbacMiddleware) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.post('/', createAlertRuleHandler(alertRepo));
    router.get('/', listAlertRulesHandler(alertRepo));
    router.put('/:id', updateAlertRuleHandler(alertRepo));
    router.delete('/:id', deleteAlertRuleHandler(alertRepo));
    return router;
}
//# sourceMappingURL=alertsRouter.js.map