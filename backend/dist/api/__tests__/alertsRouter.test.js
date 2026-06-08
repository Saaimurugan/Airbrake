"use strict";
/**
 * Unit tests for Alert Rules REST API Router
 * Requirements: 5.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
const alertsRouter_1 = require("../alertsRouter");
const rbac_1 = require("../../auth/rbac");
// ─── Test Helpers ─────────────────────────────────────────────────────────────
function makeSessionStore(session) {
    return {
        get: jest.fn().mockResolvedValue(session),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    };
}
function makeAuditRepo() {
    return { log: jest.fn().mockResolvedValue(undefined) };
}
function makeSession(role = 'viewer') {
    const now = new Date();
    return {
        userId: 'user-1',
        role,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 3600000),
    };
}
function makeAlertRule(overrides = {}) {
    return {
        id: 'rule-1',
        name: 'High Error Rate',
        threshold: 10,
        windowSeconds: 60,
        triggerOnNewError: true,
        channels: [{ type: 'email', address: 'ops@example.com' }],
        createdBy: 'user-1',
        enabled: true,
        ...overrides,
    };
}
function makeReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/alerts',
        headers: {},
        cookies: {},
        query: {},
        params: {},
        body: undefined,
        ...overrides,
    };
}
function makeRes() {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { res.statusCode = code; return res; },
        json(body) { res.body = body; },
        send() { },
    };
    return res;
}
// ─── POST /alerts ─────────────────────────────────────────────────────────────
describe('POST /alerts — create handler', () => {
    it('creates and returns alert rule with 201', async () => {
        const rule = makeAlertRule();
        const repo = {
            create: jest.fn().mockResolvedValue(rule),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        const handler = (0, alertsRouter_1.createAlertRuleHandler)(repo);
        const req = makeReq({
            method: 'POST',
            path: '/alerts',
            body: {
                name: 'High Error Rate',
                threshold: 10,
                windowSeconds: 60,
                triggerOnNewError: true,
                channels: [{ type: 'email', address: 'ops@example.com' }],
                createdBy: 'user-1',
                enabled: true,
            },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(201);
        expect(res.body).toEqual(rule);
        expect(repo.create).toHaveBeenCalledWith(req.body);
    });
});
// ─── GET /alerts ──────────────────────────────────────────────────────────────
describe('GET /alerts — list handler', () => {
    it('returns list of alert rules with 200', async () => {
        const rules = [makeAlertRule(), makeAlertRule({ id: 'rule-2', name: 'New Error' })];
        const repo = {
            create: jest.fn(),
            findAll: jest.fn().mockResolvedValue(rules),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        const handler = (0, alertsRouter_1.listAlertRulesHandler)(repo);
        const req = makeReq({ method: 'GET', path: '/alerts' });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(rules);
    });
});
// ─── PUT /alerts/:id ──────────────────────────────────────────────────────────
describe('PUT /alerts/:id — update handler', () => {
    it('updates and returns alert rule with 200', async () => {
        const updated = makeAlertRule({ name: 'Updated Rule', threshold: 20 });
        const repo = {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn().mockResolvedValue(updated),
            delete: jest.fn(),
        };
        const handler = (0, alertsRouter_1.updateAlertRuleHandler)(repo);
        const req = makeReq({
            method: 'PUT',
            params: { id: 'rule-1' },
            body: { name: 'Updated Rule', threshold: 20 },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(updated);
        expect(repo.update).toHaveBeenCalledWith('rule-1', { name: 'Updated Rule', threshold: 20 });
    });
    it('returns 404 for unknown id', async () => {
        const repo = {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn().mockResolvedValue(null),
            delete: jest.fn(),
        };
        const handler = (0, alertsRouter_1.updateAlertRuleHandler)(repo);
        const req = makeReq({ method: 'PUT', params: { id: 'nonexistent' }, body: { name: 'x' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: 'Alert rule not found.' });
    });
});
// ─── DELETE /alerts/:id ───────────────────────────────────────────────────────
describe('DELETE /alerts/:id — delete handler', () => {
    it('returns 204 on successful delete', async () => {
        const repo = {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn().mockResolvedValue(true),
        };
        const handler = (0, alertsRouter_1.deleteAlertRuleHandler)(repo);
        const req = makeReq({ method: 'DELETE', params: { id: 'rule-1' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(204);
    });
    it('returns 404 for unknown id', async () => {
        const repo = {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn().mockResolvedValue(false),
        };
        const handler = (0, alertsRouter_1.deleteAlertRuleHandler)(repo);
        const req = makeReq({ method: 'DELETE', params: { id: 'nonexistent' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: 'Alert rule not found.' });
    });
});
// ─── RBAC integration ─────────────────────────────────────────────────────────
describe('RBAC middleware integration', () => {
    function makeRbacReq(overrides = {}) {
        return {
            method: 'POST',
            path: '/alerts',
            headers: {},
            cookies: {},
            ...overrides,
        };
    }
    function makeRbacRes() {
        const res = {
            statusCode: 200,
            status(code) { res.statusCode = code; return res; },
            json(_body) { },
        };
        return res;
    }
    it('returns 401 for unauthenticated requests (no token)', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(null), makeAuditRepo());
        const req = makeRbacReq({ method: 'POST', path: '/alerts' });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('viewer cannot POST /alerts (403)', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('viewer')), makeAuditRepo());
        const req = makeRbacReq({
            method: 'POST',
            path: '/alerts',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('developer can POST /alerts', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('developer')), makeAuditRepo());
        const req = makeRbacReq({
            method: 'POST',
            path: '/alerts',
            headers: { authorization: 'Bearer dev-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
    it('viewer can GET /alerts', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('viewer')), makeAuditRepo());
        const req = makeRbacReq({
            method: 'GET',
            path: '/alerts',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=alertsRouter.test.js.map