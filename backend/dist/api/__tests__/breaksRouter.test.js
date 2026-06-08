"use strict";
/**
 * Unit tests for Breaks REST API Router
 * Requirements: 2.1, 4.1, 4.2, 4.3, 4.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
const breaksRouter_1 = require("../breaksRouter");
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
function makeBreak(overrides = {}) {
    return {
        id: 'break-1',
        applicationId: 'app-1',
        environment: 'production',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property',
        stackTrace: 'at Object.<anonymous> (app.js:10:5)',
        endpoint: '/api/users',
        requestPayload: { method: 'GET' },
        userSession: { userId: 'u-1' },
        timestamp: new Date('2024-01-15T12:00:00Z'),
        fingerprint: 'fp-abc123',
        ...overrides,
    };
}
function makeLogRecord(overrides = {}) {
    return {
        id: 'log-1',
        applicationId: 'app-1',
        environment: 'production',
        severity: 'error',
        message: 'Something went wrong',
        timestamp: new Date('2024-01-15T12:01:00Z'),
        tags: [],
        rawPayload: {},
        ...overrides,
    };
}
function makeReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/breaks',
        headers: {},
        cookies: {},
        query: {},
        params: {},
        ...overrides,
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
// ─── GET /breaks (list) ───────────────────────────────────────────────────────
describe('GET /breaks — list handler', () => {
    it('returns paginated list of breaks', async () => {
        const breaks = [makeBreak(), makeBreak({ id: 'break-2' })];
        const breakRepo = {
            findAll: jest.fn().mockResolvedValue({ data: breaks, total: 2 }),
            findById: jest.fn(),
        };
        const handler = (0, breaksRouter_1.createListBreaksHandler)(breakRepo);
        const req = makeReq({ query: {} });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ data: breaks, total: 2, page: 1, limit: 20 });
    });
    it('passes filters to repository', async () => {
        const breakRepo = {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findById: jest.fn(),
        };
        const handler = (0, breaksRouter_1.createListBreaksHandler)(breakRepo);
        const req = makeReq({
            query: { severity: 'critical', applicationId: 'app-2', page: '2', limit: '10' },
        });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(breakRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({
            severity: 'critical',
            applicationId: 'app-2',
            page: 2,
            limit: 10,
        }));
    });
    it('returns filtered results when filters are applied', async () => {
        const criticalBreak = makeBreak({ severity: 'critical', id: 'b-critical' });
        const breakRepo = {
            findAll: jest.fn().mockResolvedValue({ data: [criticalBreak], total: 1 }),
            findById: jest.fn(),
        };
        const handler = (0, breaksRouter_1.createListBreaksHandler)(breakRepo);
        const req = makeReq({ query: { severity: 'critical' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.body).toMatchObject({ data: [criticalBreak], total: 1 });
    });
    it('defaults to page=1 and limit=20 when not provided', async () => {
        const breakRepo = {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findById: jest.fn(),
        };
        const handler = (0, breaksRouter_1.createListBreaksHandler)(breakRepo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(breakRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    });
    it('passes from/to date filters to repository', async () => {
        const breakRepo = {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findById: jest.fn(),
        };
        const handler = (0, breaksRouter_1.createListBreaksHandler)(breakRepo);
        const req = makeReq({ query: { from: '2024-01-01T00:00:00Z', to: '2024-01-31T23:59:59Z' } });
        await handler(req, makeRes(), jest.fn());
        expect(breakRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({
            from: new Date('2024-01-01T00:00:00Z'),
            to: new Date('2024-01-31T23:59:59Z'),
        }));
    });
});
// ─── GET /breaks/:id (detail) ─────────────────────────────────────────────────
describe('GET /breaks/:id — detail handler', () => {
    it('returns break with correlated logs', async () => {
        const breakRecord = makeBreak();
        const logs = [makeLogRecord(), makeLogRecord({ id: 'log-2' })];
        const breakRepo = {
            findAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(breakRecord),
        };
        const logRepo = {
            findCorrelated: jest.fn().mockResolvedValue(logs),
        };
        const handler = (0, breaksRouter_1.createGetBreakHandler)(breakRepo, logRepo);
        const req = makeReq({ params: { id: 'break-1' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe('break-1');
        expect(res.body.correlatedLogs).toHaveLength(2);
    });
    it('queries correlated logs with ±5 minute window around break timestamp', async () => {
        const breakTime = new Date('2024-01-15T12:00:00Z');
        const breakRecord = makeBreak({ timestamp: breakTime });
        const breakRepo = {
            findAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(breakRecord),
        };
        const logRepo = {
            findCorrelated: jest.fn().mockResolvedValue([]),
        };
        const handler = (0, breaksRouter_1.createGetBreakHandler)(breakRepo, logRepo);
        await handler(makeReq({ params: { id: 'break-1' } }), makeRes(), jest.fn());
        expect(logRepo.findCorrelated).toHaveBeenCalledWith('app-1', new Date('2024-01-15T11:55:00Z'), new Date('2024-01-15T12:05:00Z'));
    });
    it('returns 404 for unknown break id', async () => {
        const breakRepo = {
            findAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(null),
        };
        const logRepo = { findCorrelated: jest.fn() };
        const handler = (0, breaksRouter_1.createGetBreakHandler)(breakRepo, logRepo);
        const req = makeReq({ params: { id: 'nonexistent' } });
        const res = makeRes();
        await handler(req, res, jest.fn());
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: 'Break not found.' });
        expect(logRepo.findCorrelated).not.toHaveBeenCalled();
    });
    it('includes required fields: stack trace, request payload, user session (Requirement 4.1)', async () => {
        const breakRecord = makeBreak({
            stackTrace: 'at foo (bar.js:1:1)',
            requestPayload: { method: 'POST', body: { x: 1 } },
            userSession: { sessionId: 'sess-abc' },
        });
        const breakRepo = {
            findAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(breakRecord),
        };
        const logRepo = { findCorrelated: jest.fn().mockResolvedValue([]) };
        const handler = (0, breaksRouter_1.createGetBreakHandler)(breakRepo, logRepo);
        const res = makeRes();
        await handler(makeReq({ params: { id: 'break-1' } }), res, jest.fn());
        expect(res.statusCode).toBe(200);
        const body = res.body;
        expect(body.stackTrace).toBe('at foo (bar.js:1:1)');
        expect(body.requestPayload).toEqual({ method: 'POST', body: { x: 1 } });
        expect(body.userSession).toEqual({ sessionId: 'sess-abc' });
    });
    it('returns null for requestPayload and userSession when unavailable (Requirement 4.4)', async () => {
        const breakRecord = makeBreak({ requestPayload: null, userSession: null });
        const breakRepo = {
            findAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(breakRecord),
        };
        const logRepo = { findCorrelated: jest.fn().mockResolvedValue([]) };
        const handler = (0, breaksRouter_1.createGetBreakHandler)(breakRepo, logRepo);
        const res = makeRes();
        await handler(makeReq({ params: { id: 'break-1' } }), res, jest.fn());
        expect(res.statusCode).toBe(200);
        const body = res.body;
        expect(body.requestPayload).toBeNull();
        expect(body.userSession).toBeNull();
    });
});
// ─── RBAC integration ─────────────────────────────────────────────────────────
describe('RBAC middleware integration', () => {
    function makeRbacReq(overrides = {}) {
        return {
            method: 'GET',
            path: '/breaks',
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
        const sessionStore = makeSessionStore(null);
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({ method: 'GET', path: '/breaks' });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 for invalid/expired token', async () => {
        const sessionStore = makeSessionStore(null);
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/breaks',
            headers: { authorization: 'Bearer bad-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('allows viewer-role requests to GET /breaks', async () => {
        const sessionStore = makeSessionStore(makeSession('viewer'));
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/breaks',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200); // unchanged — next() was called
    });
    it('allows viewer-role requests to GET /breaks/:id', async () => {
        const sessionStore = makeSessionStore(makeSession('viewer'));
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/breaks/break-1',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
    it('allows developer-role requests to GET /breaks', async () => {
        const sessionStore = makeSessionStore(makeSession('developer'));
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/breaks',
            headers: { authorization: 'Bearer dev-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=breaksRouter.test.js.map