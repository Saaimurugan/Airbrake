"use strict";
/**
 * Unit tests for RBAC middleware
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rbac_1 = require("../rbac");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSessionStore(session) {
    return {
        get: jest.fn().mockResolvedValue(session),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    };
}
function makeAuditRepo() {
    const entries = [];
    return {
        entries,
        log: jest.fn(async (entry) => { entries.push(entry); }),
    };
}
function makeSession(role) {
    const now = new Date();
    return {
        userId: 'user-1',
        role,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
    };
}
function makeReq(method, path, token, cookie) {
    const headers = {};
    if (token)
        headers['authorization'] = `Bearer ${token}`;
    return {
        headers,
        cookies: cookie ? { session: cookie } : {},
        method,
        path,
        ip: '127.0.0.1',
    };
}
function makeRes() {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { res.statusCode = code; return res; },
        json(body) { res.body = body; },
    };
    return res;
}
// ─── hasPermission ────────────────────────────────────────────────────────────
describe('hasPermission', () => {
    describe('viewer', () => {
        it('allows GET /breaks', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/breaks')).toBe(true));
        it('allows GET /breaks/123', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/breaks/123')).toBe(true));
        it('allows GET /logs', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/logs')).toBe(true));
        it('allows GET /dashboard', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/dashboard')).toBe(true));
        it('allows GET /filters', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/filters')).toBe(true));
        it('allows GET /alerts', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/alerts')).toBe(true));
        it('denies POST /alerts', () => expect((0, rbac_1.hasPermission)('viewer', 'POST', '/alerts')).toBe(false));
        it('denies DELETE /alerts/1', () => expect((0, rbac_1.hasPermission)('viewer', 'DELETE', '/alerts/1')).toBe(false));
        it('denies POST /filters', () => expect((0, rbac_1.hasPermission)('viewer', 'POST', '/filters')).toBe(false));
        it('denies GET /users', () => expect((0, rbac_1.hasPermission)('viewer', 'GET', '/users')).toBe(false));
        it('denies PUT /retention', () => expect((0, rbac_1.hasPermission)('viewer', 'PUT', '/retention')).toBe(false));
        it('denies POST /applications', () => expect((0, rbac_1.hasPermission)('viewer', 'POST', '/applications')).toBe(false));
    });
    describe('developer', () => {
        it('allows GET /breaks', () => expect((0, rbac_1.hasPermission)('developer', 'GET', '/breaks')).toBe(true));
        it('allows POST /alerts', () => expect((0, rbac_1.hasPermission)('developer', 'POST', '/alerts')).toBe(true));
        it('allows PUT /alerts/1', () => expect((0, rbac_1.hasPermission)('developer', 'PUT', '/alerts/1')).toBe(true));
        it('allows DELETE /alerts/1', () => expect((0, rbac_1.hasPermission)('developer', 'DELETE', '/alerts/1')).toBe(true));
        it('allows POST /filters', () => expect((0, rbac_1.hasPermission)('developer', 'POST', '/filters')).toBe(true));
        it('allows PUT /filters/1', () => expect((0, rbac_1.hasPermission)('developer', 'PUT', '/filters/1')).toBe(true));
        it('allows DELETE /filters/1', () => expect((0, rbac_1.hasPermission)('developer', 'DELETE', '/filters/1')).toBe(true));
        it('denies GET /users', () => expect((0, rbac_1.hasPermission)('developer', 'GET', '/users')).toBe(false));
        it('denies POST /users', () => expect((0, rbac_1.hasPermission)('developer', 'POST', '/users')).toBe(false));
        it('denies PUT /retention', () => expect((0, rbac_1.hasPermission)('developer', 'PUT', '/retention')).toBe(false));
        it('denies POST /applications', () => expect((0, rbac_1.hasPermission)('developer', 'POST', '/applications')).toBe(false));
    });
    describe('admin', () => {
        it('allows GET /breaks', () => expect((0, rbac_1.hasPermission)('admin', 'GET', '/breaks')).toBe(true));
        it('allows POST /alerts', () => expect((0, rbac_1.hasPermission)('admin', 'POST', '/alerts')).toBe(true));
        it('allows GET /users', () => expect((0, rbac_1.hasPermission)('admin', 'GET', '/users')).toBe(true));
        it('allows POST /users', () => expect((0, rbac_1.hasPermission)('admin', 'POST', '/users')).toBe(true));
        it('allows PUT /users/1', () => expect((0, rbac_1.hasPermission)('admin', 'PUT', '/users/1')).toBe(true));
        it('allows DELETE /users/1', () => expect((0, rbac_1.hasPermission)('admin', 'DELETE', '/users/1')).toBe(true));
        it('allows GET /retention', () => expect((0, rbac_1.hasPermission)('admin', 'GET', '/retention')).toBe(true));
        it('allows PUT /retention', () => expect((0, rbac_1.hasPermission)('admin', 'PUT', '/retention')).toBe(true));
        it('allows POST /applications', () => expect((0, rbac_1.hasPermission)('admin', 'POST', '/applications')).toBe(true));
    });
});
// ─── createRbacMiddleware ─────────────────────────────────────────────────────
describe('createRbacMiddleware', () => {
    it('returns 401 when no token is provided', async () => {
        const store = makeSessionStore(null);
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/breaks');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 when token is invalid/expired (session not found)', async () => {
        const store = makeSessionStore(null);
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/breaks', 'bad-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 when session is expired', async () => {
        const expired = {
            userId: 'user-1',
            role: 'viewer',
            createdAt: new Date(Date.now() - 200000),
            expiresAt: new Date(Date.now() - 100000), // already expired
        };
        const store = makeSessionStore(expired);
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/breaks', 'expired-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 403 and writes audit log when viewer tries to POST /alerts', async () => {
        const store = makeSessionStore(makeSession('viewer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('POST', '/alerts', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
        expect(audit.entries).toHaveLength(1);
        expect(audit.entries[0]).toMatchObject({
            userId: 'user-1',
            outcome: 'denied',
            resource: '/alerts',
        });
    });
    it('returns 403 and writes audit log when developer tries to GET /users', async () => {
        const store = makeSessionStore(makeSession('developer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/users', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
        expect(audit.entries[0].outcome).toBe('denied');
    });
    it('calls next() and attaches session for authorized viewer GET /breaks', async () => {
        const store = makeSessionStore(makeSession('viewer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/breaks', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(200); // unchanged
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session).toEqual({ userId: 'user-1', role: 'viewer' });
        expect(audit.entries).toHaveLength(0);
    });
    it('calls next() for developer POST /alerts', async () => {
        const store = makeSessionStore(makeSession('developer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('POST', '/alerts', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(audit.entries).toHaveLength(0);
    });
    it('calls next() for admin GET /users', async () => {
        const store = makeSessionStore(makeSession('admin'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/users', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(audit.entries).toHaveLength(0);
    });
    it('extracts token from cookie when no Authorization header', async () => {
        const store = makeSessionStore(makeSession('viewer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/breaks', undefined, 'cookie-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(store.get).toHaveBeenCalledWith('cookie-token');
    });
    it('does not write audit log on successful access', async () => {
        const store = makeSessionStore(makeSession('admin'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('PUT', '/retention', 'valid-token');
        const res = makeRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(audit.entries).toHaveLength(0);
    });
});
//# sourceMappingURL=rbac.test.js.map