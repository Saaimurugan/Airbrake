"use strict";
/**
 * Unit tests for Admin REST API Router (User Management & Retention Policies)
 * Requirements: 6.1, 6.5, 9.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
const adminRouter_1 = require("../adminRouter");
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
function makeSession(role = 'admin') {
    const now = new Date();
    return {
        userId: 'user-1',
        role,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 3600000),
    };
}
function makeUser(overrides = {}) {
    return {
        id: 'user-1',
        email: 'alice@example.com',
        role: 'developer',
        oauthProvider: 'google',
        oauthSubject: 'sub-123',
        createdAt: new Date('2024-01-01'),
        ...overrides,
    };
}
function makeRetentionPolicy(overrides = {}) {
    return {
        applicationId: 'app-1',
        retentionDays: 30,
        ...overrides,
    };
}
function makeReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/users',
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
function makeRbacReq(overrides = {}) {
    return {
        method: 'POST',
        path: '/users',
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
// ─── GET /users ───────────────────────────────────────────────────────────────
describe('GET /users — list handler', () => {
    it('returns list of users with 200', async () => {
        const users = [makeUser(), makeUser({ id: 'user-2', email: 'bob@example.com' })];
        const repo = {
            findAll: jest.fn().mockResolvedValue(users),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        const handler = (0, adminRouter_1.listUsersHandler)(repo);
        const req = makeReq({ method: 'GET', path: '/users' });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(users);
    });
});
// ─── POST /users ──────────────────────────────────────────────────────────────
describe('POST /users — create handler', () => {
    it('creates and returns user with 201', async () => {
        const user = makeUser();
        const repo = {
            findAll: jest.fn(),
            create: jest.fn().mockResolvedValue(user),
            update: jest.fn(),
            delete: jest.fn(),
        };
        const handler = (0, adminRouter_1.createUserHandler)(repo);
        const req = makeReq({
            method: 'POST',
            path: '/users',
            body: {
                email: 'alice@example.com',
                role: 'developer',
                oauthProvider: 'google',
                oauthSubject: 'sub-123',
            },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(201);
        expect(res.body).toEqual(user);
        expect(repo.create).toHaveBeenCalledWith(req.body);
    });
});
// ─── PUT /users/:id ───────────────────────────────────────────────────────────
describe('PUT /users/:id — update handler', () => {
    it('updates and returns user with 200', async () => {
        const updated = makeUser({ role: 'admin' });
        const repo = {
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(updated),
            delete: jest.fn(),
        };
        const handler = (0, adminRouter_1.updateUserHandler)(repo);
        const req = makeReq({
            method: 'PUT',
            params: { id: 'user-1' },
            body: { role: 'admin' },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(updated);
        expect(repo.update).toHaveBeenCalledWith('user-1', { role: 'admin' });
    });
    it('returns 404 for unknown id', async () => {
        const repo = {
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(null),
            delete: jest.fn(),
        };
        const handler = (0, adminRouter_1.updateUserHandler)(repo);
        const req = makeReq({ method: 'PUT', params: { id: 'nonexistent' }, body: { role: 'viewer' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: 'User not found.' });
    });
});
// ─── DELETE /users/:id ────────────────────────────────────────────────────────
describe('DELETE /users/:id — delete handler', () => {
    it('returns 204 on successful delete', async () => {
        const repo = {
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn().mockResolvedValue(true),
        };
        const handler = (0, adminRouter_1.deleteUserHandler)(repo);
        const req = makeReq({ method: 'DELETE', params: { id: 'user-1' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(204);
    });
});
// ─── GET /retention ───────────────────────────────────────────────────────────
describe('GET /retention — list handler', () => {
    it('returns list of retention policies with 200', async () => {
        const policies = [makeRetentionPolicy(), makeRetentionPolicy({ applicationId: 'app-2', retentionDays: 60 })];
        const repo = {
            findAll: jest.fn().mockResolvedValue(policies),
            upsert: jest.fn(),
        };
        const handler = (0, adminRouter_1.listRetentionPoliciesHandler)(repo);
        const req = makeReq({ method: 'GET', path: '/retention' });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(policies);
    });
});
// ─── PUT /retention ───────────────────────────────────────────────────────────
describe('PUT /retention — upsert handler', () => {
    it('upserts and returns retention policy with 200', async () => {
        const policy = makeRetentionPolicy({ retentionDays: 90 });
        const repo = {
            findAll: jest.fn(),
            upsert: jest.fn().mockResolvedValue(policy),
        };
        const handler = (0, adminRouter_1.upsertRetentionPolicyHandler)(repo);
        const req = makeReq({
            method: 'PUT',
            path: '/retention',
            body: { applicationId: 'app-1', retentionDays: 90 },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(policy);
        expect(repo.upsert).toHaveBeenCalledWith(req.body);
    });
});
// ─── RBAC integration ─────────────────────────────────────────────────────────
describe('RBAC middleware integration', () => {
    it('returns 401 for unauthenticated requests (no token)', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(null), makeAuditRepo());
        const req = makeRbacReq({ method: 'POST', path: '/users' });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('developer cannot POST /users (403)', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('developer')), makeAuditRepo());
        const req = makeRbacReq({
            method: 'POST',
            path: '/users',
            headers: { authorization: 'Bearer dev-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('admin can POST /users', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('admin')), makeAuditRepo());
        const req = makeRbacReq({
            method: 'POST',
            path: '/users',
            headers: { authorization: 'Bearer admin-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=adminRouter.test.js.map