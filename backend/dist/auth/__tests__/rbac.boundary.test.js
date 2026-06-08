"use strict";
/**
 * RBAC Boundary Condition Unit Tests
 * Requirements: 6.3, 6.4, 6.5, 6.6
 *
 * Covers exact permission boundaries between roles, audit log behaviour,
 * path-prefix matching, and method case-insensitivity.
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
        userId: 'user-boundary',
        role,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
    };
}
function makeReq(method, path, token) {
    const headers = {};
    if (token)
        headers['authorization'] = `Bearer ${token}`;
    return { headers, cookies: {}, method, path, ip: '10.0.0.1' };
}
function makeRes() {
    const res = {
        statusCode: 200,
        status(code) { res.statusCode = code; return res; },
        json(_body) { },
    };
    return res;
}
// ─── 1. Viewer / Developer boundary on /alerts ────────────────────────────────
describe('Boundary: viewer vs developer on /alerts (Req 6.3, 6.4)', () => {
    it('viewer CAN GET /alerts', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'GET', '/alerts')).toBe(true);
    });
    it('viewer CANNOT POST /alerts', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'POST', '/alerts')).toBe(false);
    });
    it('developer CAN POST /alerts', () => {
        expect((0, rbac_1.hasPermission)('developer', 'POST', '/alerts')).toBe(true);
    });
});
// ─── 2. Developer boundary: /alerts allowed, /users denied ───────────────────
describe('Boundary: developer allowed on /alerts but denied on /users (Req 6.4, 6.5)', () => {
    it('developer CAN POST /alerts', () => {
        expect((0, rbac_1.hasPermission)('developer', 'POST', '/alerts')).toBe(true);
    });
    it('developer CANNOT GET /users', () => {
        expect((0, rbac_1.hasPermission)('developer', 'GET', '/users')).toBe(false);
    });
});
// ─── 3. Developer boundary: /filters allowed, /retention denied ──────────────
describe('Boundary: developer allowed on /filters but denied on /retention (Req 6.4, 6.5)', () => {
    it('developer CAN DELETE /filters', () => {
        expect((0, rbac_1.hasPermission)('developer', 'DELETE', '/filters')).toBe(true);
    });
    it('developer CANNOT PUT /retention', () => {
        expect((0, rbac_1.hasPermission)('developer', 'PUT', '/retention')).toBe(false);
    });
});
// ─── 4. Admin can do everything ───────────────────────────────────────────────
describe('Admin has full access across all paths and methods (Req 6.5)', () => {
    const paths = ['/breaks', '/logs', '/dashboard', '/filters', '/alerts', '/applications', '/users', '/retention'];
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    // Admin inherits all viewer + developer permissions
    it.each([
        ['GET', '/breaks'],
        ['GET', '/logs'],
        ['GET', '/dashboard'],
        ['GET', '/filters'],
        ['GET', '/alerts'],
        ['GET', '/applications'],
        ['POST', '/alerts'],
        ['PUT', '/alerts'],
        ['DELETE', '/alerts'],
        ['POST', '/filters'],
        ['PUT', '/filters'],
        ['DELETE', '/filters'],
    ])('admin CAN %s %s', (method, path) => {
        expect((0, rbac_1.hasPermission)('admin', method, path)).toBe(true);
    });
    // Admin-exclusive paths
    it.each([
        ['GET', '/users'],
        ['POST', '/users'],
        ['PUT', '/users'],
        ['DELETE', '/users'],
        ['GET', '/retention'],
        ['PUT', '/retention'],
        ['POST', '/applications'],
    ])('admin CAN %s %s (admin-exclusive)', (method, path) => {
        expect((0, rbac_1.hasPermission)('admin', method, path)).toBe(true);
    });
});
// ─── 5. Audit log IS written on 403 (valid session, denied) ──────────────────
describe('Audit log on 403 (Req 6.6)', () => {
    it('writes audit log entry when viewer is denied POST /alerts', async () => {
        const store = makeSessionStore(makeSession('viewer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('POST', '/alerts', 'tok');
        const res = makeRes();
        await middleware(req, res, jest.fn());
        expect(res.statusCode).toBe(403);
        expect(audit.entries).toHaveLength(1);
        expect(audit.entries[0]).toMatchObject({
            userId: 'user-boundary',
            outcome: 'denied',
            resource: '/alerts',
        });
    });
    it('writes audit log entry when developer is denied GET /users', async () => {
        const store = makeSessionStore(makeSession('developer'));
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('GET', '/users', 'tok');
        const res = makeRes();
        await middleware(req, res, jest.fn());
        expect(res.statusCode).toBe(403);
        expect(audit.entries).toHaveLength(1);
        expect(audit.entries[0]).toMatchObject({
            userId: 'user-boundary',
            outcome: 'denied',
            resource: '/users',
        });
    });
});
// ─── 6. Audit log IS NOT written on 401 (no session) ─────────────────────────
describe('No audit log on 401 (Req 6.6)', () => {
    it('does NOT write audit log when no token is provided', async () => {
        const store = makeSessionStore(null);
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('POST', '/alerts'); // no token
        const res = makeRes();
        await middleware(req, res, jest.fn());
        expect(res.statusCode).toBe(401);
        expect(audit.entries).toHaveLength(0);
    });
    it('does NOT write audit log when token is invalid (session not found)', async () => {
        const store = makeSessionStore(null);
        const audit = makeAuditRepo();
        const middleware = (0, rbac_1.createRbacMiddleware)(store, audit);
        const req = makeReq('DELETE', '/users', 'invalid-token');
        const res = makeRes();
        await middleware(req, res, jest.fn());
        expect(res.statusCode).toBe(401);
        expect(audit.entries).toHaveLength(0);
    });
});
// ─── 7. Path prefix matching ──────────────────────────────────────────────────
describe('Path prefix matching (Req 6.3)', () => {
    it('viewer GET /breaks/123 is allowed (sub-path of /breaks)', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'GET', '/breaks/123')).toBe(true);
    });
    it('viewer GET /breaks/abc/def is allowed (deep sub-path)', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'GET', '/breaks/abc/def')).toBe(true);
    });
    it('viewer GET /alerts/456 is allowed (sub-path of /alerts)', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'GET', '/alerts/456')).toBe(true);
    });
    it('viewer GET /breaksnew is NOT allowed (not a sub-path, just a prefix string match)', () => {
        // /breaksnew does not start with /breaks/ or equal /breaks
        expect((0, rbac_1.hasPermission)('viewer', 'GET', '/breaksnew')).toBe(false);
    });
    it('developer DELETE /filters/99 is allowed (sub-path of /filters)', () => {
        expect((0, rbac_1.hasPermission)('developer', 'DELETE', '/filters/99')).toBe(true);
    });
    it('admin PUT /users/42 is allowed (sub-path of /users)', () => {
        expect((0, rbac_1.hasPermission)('admin', 'PUT', '/users/42')).toBe(true);
    });
});
// ─── 8. Method case-insensitivity ─────────────────────────────────────────────
describe('Method case-insensitivity (Req 6.3)', () => {
    it('viewer "get" (lowercase) /breaks is allowed', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'get', '/breaks')).toBe(true);
    });
    it('viewer "Get" (mixed case) /logs is allowed', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'Get', '/logs')).toBe(true);
    });
    it('developer "post" (lowercase) /alerts is allowed', () => {
        expect((0, rbac_1.hasPermission)('developer', 'post', '/alerts')).toBe(true);
    });
    it('developer "delete" (lowercase) /filters is allowed', () => {
        expect((0, rbac_1.hasPermission)('developer', 'delete', '/filters')).toBe(true);
    });
    it('admin "put" (lowercase) /retention is allowed', () => {
        expect((0, rbac_1.hasPermission)('admin', 'put', '/retention')).toBe(true);
    });
    it('viewer "POST" (uppercase) /alerts is still denied', () => {
        expect((0, rbac_1.hasPermission)('viewer', 'POST', '/alerts')).toBe(false);
    });
});
//# sourceMappingURL=rbac.boundary.test.js.map