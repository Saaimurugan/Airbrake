"use strict";
/**
 * Unit tests for Dashboard Aggregation REST API Router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dashboardRouter_1 = require("../dashboardRouter");
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
function makeReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/dashboard',
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
function makeRepo(overrides = {}) {
    return {
        countBreaks: jest.fn().mockResolvedValue(0),
        getErrorRateTrend: jest.fn().mockResolvedValue([]),
        getTopServices: jest.fn().mockResolvedValue([]),
        getTimeSeries: jest.fn().mockResolvedValue([]),
        getSeverityBreakdown: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}
// ─── GET /dashboard ───────────────────────────────────────────────────────────
describe('GET /dashboard — aggregation handler', () => {
    it('returns all aggregation fields (Requirements 3.1–3.6)', async () => {
        const trend = [{ timestamp: new Date('2024-01-15T10:00:00Z'), count: 5 }];
        const topSvcs = [{ applicationId: 'app-1', count: 42 }];
        const ts = [{ timestamp: new Date('2024-01-15T00:00:00Z'), count: 10 }];
        const severity = { error: 30, critical: 12 };
        const repo = makeRepo({
            countBreaks: jest.fn()
                .mockResolvedValueOnce(15) // 24h
                .mockResolvedValueOnce(120), // 7d
            getErrorRateTrend: jest.fn().mockResolvedValue(trend),
            getTopServices: jest.fn().mockResolvedValue(topSvcs),
            getTimeSeries: jest.fn().mockResolvedValue(ts),
            getSeverityBreakdown: jest.fn().mockResolvedValue(severity),
        });
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        const res = makeRes();
        await handler(makeReq(), res, jest.fn());
        expect(res.statusCode).toBe(200);
        const body = res.body;
        expect(body.breakCount24h).toBe(15);
        expect(body.breakCount7d).toBe(120);
        expect(body.errorRateTrend).toEqual(trend);
        expect(body.topServices).toEqual(topSvcs);
        expect(body.timeSeries).toEqual(ts);
        expect(body.severityBreakdown).toEqual(severity);
        expect(body.deploymentEvents).toEqual([]);
    });
    it('calls countBreaks with 24 for 24h and 168 for 7d (Requirement 3.1)', async () => {
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(repo.countBreaks).toHaveBeenCalledWith(24);
        expect(repo.countBreaks).toHaveBeenCalledWith(168);
    });
    it('defaults granularity to hourly when not specified (Requirement 3.4)', async () => {
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(repo.getTimeSeries).toHaveBeenCalledWith('hourly', expect.any(Date), expect.any(Date));
    });
    it('passes granularity=daily to getTimeSeries (Requirement 3.4)', async () => {
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq({ query: { granularity: 'daily' } }), makeRes(), jest.fn());
        expect(repo.getTimeSeries).toHaveBeenCalledWith('daily', expect.any(Date), expect.any(Date));
    });
    it('passes from/to date range to getTimeSeries (Requirement 3.4)', async () => {
        const from = '2024-01-01T00:00:00Z';
        const to = '2024-01-07T23:59:59Z';
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq({ query: { from, to } }), makeRes(), jest.fn());
        expect(repo.getTimeSeries).toHaveBeenCalledWith('hourly', new Date(from), new Date(to));
    });
    it('includes deployment events when getDeploymentEvents is available (Requirement 3.6)', async () => {
        const events = [
            { timestamp: new Date('2024-01-15T08:00:00Z'), applicationId: 'app-1', version: 'v1.2.3' },
        ];
        const repo = makeRepo({
            getDeploymentEvents: jest.fn().mockResolvedValue(events),
        });
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        const res = makeRes();
        await handler(makeReq(), res, jest.fn());
        expect(res.body.deploymentEvents).toEqual(events);
    });
    it('returns empty deploymentEvents array when getDeploymentEvents is not defined (Requirement 3.6)', async () => {
        const repo = makeRepo();
        // Ensure getDeploymentEvents is not present
        delete repo.getDeploymentEvents;
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        const res = makeRes();
        await handler(makeReq(), res, jest.fn());
        expect(res.body.deploymentEvents).toEqual([]);
    });
    it('calls getTopServices with limit 10 (Requirement 3.3)', async () => {
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(repo.getTopServices).toHaveBeenCalledWith(10);
    });
    it('calls getErrorRateTrend with 24h window and 1h buckets (Requirement 3.2)', async () => {
        const repo = makeRepo();
        const handler = (0, dashboardRouter_1.createGetDashboardHandler)(repo);
        await handler(makeReq(), makeRes(), jest.fn());
        expect(repo.getErrorRateTrend).toHaveBeenCalledWith(24, 1);
    });
});
// ─── RBAC integration ─────────────────────────────────────────────────────────
describe('RBAC middleware — /dashboard', () => {
    function makeRbacReq(overrides = {}) {
        return {
            method: 'GET',
            path: '/dashboard',
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
    it('returns 401 for unauthenticated requests', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(null), makeAuditRepo());
        const res = makeRbacRes();
        await middleware(makeRbacReq(), res, jest.fn());
        expect(res.statusCode).toBe(401);
    });
    it('allows viewer-role requests to GET /dashboard', async () => {
        const middleware = (0, rbac_1.createRbacMiddleware)(makeSessionStore(makeSession('viewer')), makeAuditRepo());
        const next = jest.fn();
        const res = makeRbacRes();
        await middleware(makeRbacReq({ headers: { authorization: 'Bearer viewer-token' } }), res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=dashboardRouter.test.js.map