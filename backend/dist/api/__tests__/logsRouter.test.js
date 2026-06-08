"use strict";
/**
 * Unit tests for Logs REST API Router
 * Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.5, 9.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logsRouter_1 = require("../logsRouter");
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
function makeLogRecord(overrides = {}) {
    return {
        id: 'log-1',
        applicationId: 'app-1',
        environment: 'production',
        severity: 'error',
        message: 'Something went wrong',
        timestamp: new Date('2024-01-15T12:00:00Z'),
        tags: ['api', 'auth'],
        rawPayload: {},
        ...overrides,
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
function makeReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/logs',
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
        sentBody: undefined,
        headers: {},
        status(code) { res.statusCode = code; return res; },
        json(body) { res.body = body; },
        setHeader(name, value) { res.headers[name] = value; },
        send(body) { res.sentBody = body; },
    };
    return res;
}
// ─── toCsv helper ─────────────────────────────────────────────────────────────
describe('toCsv helper', () => {
    it('produces a header row followed by data rows', () => {
        const records = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
        const csv = (0, logsRouter_1.toCsv)(records, ['id', 'name']);
        const lines = csv.split('\n');
        expect(lines[0]).toBe('id,name');
        expect(lines[1]).toBe('1,Alice');
        expect(lines[2]).toBe('2,Bob');
    });
    it('wraps values containing commas in double quotes', () => {
        const records = [{ id: '1', msg: 'hello, world' }];
        const csv = (0, logsRouter_1.toCsv)(records, ['id', 'msg']);
        expect(csv).toContain('"hello, world"');
    });
    it('returns only header row for empty records', () => {
        const csv = (0, logsRouter_1.toCsv)([], ['id', 'name']);
        expect(csv).toBe('id,name');
    });
});
// ─── GET /logs (search) ───────────────────────────────────────────────────────
describe('GET /logs — search handler', () => {
    it('returns paginated results', async () => {
        const logs = [makeLogRecord(), makeLogRecord({ id: 'log-2' })];
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: logs, total: 2 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        const res = makeRes();
        await handler(makeReq(), res, jest.fn());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ data: logs, total: 2, page: 1, limit: 20 });
    });
    it('passes keyword filter to repository', async () => {
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        await handler(makeReq({ query: { keyword: 'TypeError' } }), makeRes(), jest.fn());
        expect(logRepo.search).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'TypeError' }));
    });
    it('passes tags (comma-separated) to repository as array', async () => {
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        await handler(makeReq({ query: { tags: 'api,auth' } }), makeRes(), jest.fn());
        expect(logRepo.search).toHaveBeenCalledWith(expect.objectContaining({ tags: ['api', 'auth'] }));
    });
    it('passes severity, applicationId, environment filters', async () => {
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        await handler(makeReq({ query: { severity: 'critical', applicationId: 'app-2', environment: 'qa' } }), makeRes(), jest.fn());
        expect(logRepo.search).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical', applicationId: 'app-2', environment: 'qa' }));
    });
    it('passes from/to date filters to repository', async () => {
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        await handler(makeReq({ query: { from: '2024-01-01T00:00:00Z', to: '2024-03-31T23:59:59Z' } }), makeRes(), jest.fn());
        expect(logRepo.search).toHaveBeenCalledWith(expect.objectContaining({
            from: new Date('2024-01-01T00:00:00Z'),
            to: new Date('2024-03-31T23:59:59Z'),
        }));
    });
    it('defaults to page=1 and limit=20', async () => {
        const logRepo = {
            search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            searchAll: jest.fn(),
        };
        const handler = (0, logsRouter_1.createSearchLogsHandler)(logRepo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(logRepo.search).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    });
});
// ─── GET /logs/export ─────────────────────────────────────────────────────────
describe('GET /logs/export — export handler', () => {
    it('returns JSON array when format=json', async () => {
        const logs = [makeLogRecord(), makeLogRecord({ id: 'log-2' })];
        const logRepo = {
            search: jest.fn(),
            searchAll: jest.fn().mockResolvedValue(logs),
        };
        const handler = (0, logsRouter_1.createExportLogsHandler)(logRepo);
        const res = makeRes();
        await handler(makeReq({ query: { format: 'json' } }), res, jest.fn());
        expect(res.body).toEqual(logs);
    });
    it('returns CSV string with header when format=csv', async () => {
        const logs = [makeLogRecord()];
        const logRepo = {
            search: jest.fn(),
            searchAll: jest.fn().mockResolvedValue(logs),
        };
        const handler = (0, logsRouter_1.createExportLogsHandler)(logRepo);
        const res = makeRes();
        await handler(makeReq({ query: { format: 'csv' } }), res, jest.fn());
        expect(res.headers['Content-Type']).toBe('text/csv');
        expect(res.sentBody).toBeDefined();
        const lines = res.sentBody.split('\n');
        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('severity');
        expect(lines.length).toBeGreaterThan(1);
    });
    it('defaults to JSON when format is not specified', async () => {
        const logs = [makeLogRecord()];
        const logRepo = {
            search: jest.fn(),
            searchAll: jest.fn().mockResolvedValue(logs),
        };
        const handler = (0, logsRouter_1.createExportLogsHandler)(logRepo);
        const res = makeRes();
        await handler(makeReq({ query: {} }), res, jest.fn());
        expect(res.body).toEqual(logs);
    });
    it('passes filters to searchAll', async () => {
        const logRepo = {
            search: jest.fn(),
            searchAll: jest.fn().mockResolvedValue([]),
        };
        const handler = (0, logsRouter_1.createExportLogsHandler)(logRepo);
        await handler(makeReq({ query: { keyword: 'crash', severity: 'error', format: 'json' } }), makeRes(), jest.fn());
        expect(logRepo.searchAll).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'crash', severity: 'error' }));
    });
});
// ─── GET /breaks/export ───────────────────────────────────────────────────────
describe('GET /breaks/export — export handler', () => {
    it('returns JSON array of breaks when format=json', async () => {
        const breaks = [makeBreak(), makeBreak({ id: 'break-2' })];
        const breakExportRepo = {
            exportAll: jest.fn().mockResolvedValue(breaks),
        };
        const handler = (0, logsRouter_1.createExportBreaksHandler)(breakExportRepo);
        const res = makeRes();
        await handler(makeReq({ query: { format: 'json' } }), res, jest.fn());
        expect(res.body).toEqual(breaks);
    });
    it('returns CSV string with header when format=csv', async () => {
        const breaks = [makeBreak()];
        const breakExportRepo = {
            exportAll: jest.fn().mockResolvedValue(breaks),
        };
        const handler = (0, logsRouter_1.createExportBreaksHandler)(breakExportRepo);
        const res = makeRes();
        await handler(makeReq({ query: { format: 'csv' } }), res, jest.fn());
        expect(res.headers['Content-Type']).toBe('text/csv');
        expect(res.sentBody).toBeDefined();
        const lines = res.sentBody.split('\n');
        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('errorMessage');
        expect(lines.length).toBeGreaterThan(1);
    });
    it('passes filters to exportAll', async () => {
        const breakExportRepo = {
            exportAll: jest.fn().mockResolvedValue([]),
        };
        const handler = (0, logsRouter_1.createExportBreaksHandler)(breakExportRepo);
        await handler(makeReq({ query: { severity: 'critical', applicationId: 'app-3', format: 'json' } }), makeRes(), jest.fn());
        expect(breakExportRepo.exportAll).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical', applicationId: 'app-3' }));
    });
});
// ─── RBAC integration ─────────────────────────────────────────────────────────
describe('RBAC middleware integration — /logs', () => {
    function makeRbacReq(overrides = {}) {
        return {
            method: 'GET',
            path: '/logs',
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
        const req = makeRbacReq({ method: 'GET', path: '/logs' });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('allows viewer-role requests to GET /logs', async () => {
        const sessionStore = makeSessionStore(makeSession('viewer'));
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/logs',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
    it('allows viewer-role requests to GET /logs/export', async () => {
        const sessionStore = makeSessionStore(makeSession('viewer'));
        const auditRepo = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(sessionStore, auditRepo);
        const req = makeRbacReq({
            method: 'GET',
            path: '/logs/export',
            headers: { authorization: 'Bearer viewer-token' },
        });
        const res = makeRbacRes();
        const next = jest.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=logsRouter.test.js.map