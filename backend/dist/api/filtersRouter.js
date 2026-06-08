"use strict";
/**
 * Saved Filters REST API Router
 * Requirements: 8.3, 8.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSavedFilterHandler = createSavedFilterHandler;
exports.getFilterHandler = getFilterHandler;
exports.updateFilterHandler = updateFilterHandler;
exports.deleteFilterHandler = deleteFilterHandler;
exports.createFiltersRouterSync = createFiltersRouterSync;
const rbac_1 = require("../auth/rbac");
// ─── Handler Factories ────────────────────────────────────────────────────────
/**
 * POST /filters — create a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
function createSavedFilterHandler(repo) {
    return async (req, res) => {
        const body = req.body;
        const created = await repo.create(body);
        res.status(201).json(created);
    };
}
/**
 * GET /filters/:id — get a saved filter by id (Viewer+).
 * Requirements: 8.3
 */
function getFilterHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const filter = await repo.findById(id);
        if (!filter) {
            res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
            return;
        }
        res.status(200).json(filter);
    };
}
/**
 * PUT /filters/:id — update a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
function updateFilterHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const body = req.body;
        const updated = await repo.update(id, body);
        if (!updated) {
            res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
            return;
        }
        res.status(200).json(updated);
    };
}
/**
 * DELETE /filters/:id — delete a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
function deleteFilterHandler(repo) {
    return async (req, res) => {
        const { id } = req.params;
        const deleted = await repo.delete(id);
        if (!deleted) {
            res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
            return;
        }
        res.status(204).send();
    };
}
// ─── Router Factory ───────────────────────────────────────────────────────────
function createFiltersRouterSync(filterRepo, sessionStore, auditLogRepo, rbacMiddleware) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    const rbac = rbacMiddleware ?? (0, rbac_1.createRbacMiddleware)(sessionStore, auditLogRepo);
    router.use(rbac);
    router.post('/', createSavedFilterHandler(filterRepo));
    router.get('/:id', getFilterHandler(filterRepo));
    router.put('/:id', updateFilterHandler(filterRepo));
    router.delete('/:id', deleteFilterHandler(filterRepo));
    return router;
}
//# sourceMappingURL=filtersRouter.js.map