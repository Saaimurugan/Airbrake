"use strict";
/**
 * Admin REST API Router — User Management & Retention Policies
 * Requirements: 6.1, 6.5, 9.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsersHandler = listUsersHandler;
exports.createUserHandler = createUserHandler;
exports.updateUserHandler = updateUserHandler;
exports.deleteUserHandler = deleteUserHandler;
exports.listRetentionPoliciesHandler = listRetentionPoliciesHandler;
exports.upsertRetentionPolicyHandler = upsertRetentionPolicyHandler;
exports.createAdminRouterSync = createAdminRouterSync;
const rbac_1 = require("../auth/rbac");
// ─── User Handler Factories ───────────────────────────────────────────────────
/**
 * GET /users — list all users (Admin only).
 * Requirements: 6.1
 */
function listUsersHandler(repo) {
    return async (_req, res) => {
        const users = await repo.findAll();
        res.status(200).json(users);
    };
}
/**
 * POST /users — create a user (Admin only).
 * Requirements: 6.1
 */
function createUserHandler(repo) {
    return async (req, res) => {
        const body = req.body;
        const created = await repo.create(body);
        res.status(201).json(created);
    };
}
/**
 * PUT /users/:id — update a user (Admin only).
 * Requirements: 6.1
 */
function updateUserHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const body = req.body;
        const updated = await repo.update(id, body);
        if (!updated) {
            res.status(404).json({ error: 'Not Found', message: 'User not found.' });
            return;
        }
        res.status(200).json(updated);
    };
}
/**
 * DELETE /users/:id — delete a user (Admin only).
 * Requirements: 6.1
 */
function deleteUserHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const deleted = await repo.delete(id);
        if (!deleted) {
            res.status(404).json({ error: 'Not Found', message: 'User not found.' });
            return;
        }
        res.status(204).send();
    };
}
// ─── Retention Policy Handler Factories ──────────────────────────────────────
/**
 * GET /retention — list retention policies (Admin only).
 * Requirements: 9.1
 */
function listRetentionPoliciesHandler(repo) {
    return async (_req, res) => {
        const policies = await repo.findAll();
        res.status(200).json(policies);
    };
}
/**
 * PUT /retention — upsert a retention policy (Admin only).
 * Requirements: 9.1
 */
function upsertRetentionPolicyHandler(repo) {
    return async (req, res) => {
        const body = req.body;
        const policy = await repo.upsert(body);
        res.status(200).json(policy);
    };
}
// ─── Router Factory ───────────────────────────────────────────────────────────
function createAdminRouterSync(userRepo, retentionRepo, sessionStore, auditLogRepo, rbacMiddleware) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    // User endpoints
    router.get('/users', listUsersHandler(userRepo));
    router.post('/users', createUserHandler(userRepo));
    router.put('/users/:id', updateUserHandler(userRepo));
    router.delete('/users/:id', deleteUserHandler(userRepo));
    // Retention policy endpoints
    router.get('/retention', listRetentionPoliciesHandler(retentionRepo));
    router.put('/retention', upsertRetentionPolicyHandler(retentionRepo));
    return router;
}
//# sourceMappingURL=adminRouter.js.map