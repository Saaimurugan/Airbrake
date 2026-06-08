"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const oauthHandler_1 = require("../oauthHandler");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSessionStore(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        async get(token) { return store.get(token) ?? null; },
        async set(token, data) { store.set(token, data); },
        async delete(token) { store.delete(token); },
    };
}
function makeUserRepo(users = []) {
    const db = new Map(users.map(u => [`${u.oauthProvider}:${u.oauthSubject}`, u]));
    return {
        async findByOAuthSubject(provider, subject) {
            return db.get(`${provider}:${subject}`) ?? null;
        },
        async save(partial) {
            const user = {
                id: `user-${Math.random()}`,
                createdAt: new Date(),
                ...partial,
            };
            db.set(`${user.oauthProvider}:${user.oauthSubject}`, user);
            return user;
        },
    };
}
function makeOAuthProvider(userInfo = { subject: 'sub-1', email: 'dev@example.com', provider: 'google' }) {
    return {
        async exchangeCode(_code) { return { accessToken: 'access-token' }; },
        async getUserInfo(_token) { return userInfo; },
    };
}
// ─── createSession ────────────────────────────────────────────────────────────
describe('createSession', () => {
    it('returns a non-empty token string', async () => {
        const store = makeSessionStore();
        const token = await (0, oauthHandler_1.createSession)('user-1', 'developer', store);
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });
    it('stores session data with correct userId and role', async () => {
        const store = makeSessionStore();
        const token = await (0, oauthHandler_1.createSession)('user-42', 'admin', store);
        const data = await store.get(token);
        expect(data?.userId).toBe('user-42');
        expect(data?.role).toBe('admin');
    });
    it('sets expiresAt ~24 hours in the future', async () => {
        const before = Date.now();
        const store = makeSessionStore();
        const token = await (0, oauthHandler_1.createSession)('user-1', 'viewer', store);
        const data = await store.get(token);
        const ttlMs = new Date(data.expiresAt).getTime() - before;
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        expect(ttlMs).toBeGreaterThanOrEqual(twentyFourHoursMs - 1000);
        expect(ttlMs).toBeLessThanOrEqual(twentyFourHoursMs + 1000);
    });
    it('generates unique tokens for each call', async () => {
        const store = makeSessionStore();
        const t1 = await (0, oauthHandler_1.createSession)('user-1', 'viewer', store);
        const t2 = await (0, oauthHandler_1.createSession)('user-1', 'viewer', store);
        expect(t1).not.toBe(t2);
    });
});
// ─── getSession ───────────────────────────────────────────────────────────────
describe('getSession', () => {
    it('returns session data for a valid token', async () => {
        const store = makeSessionStore();
        const token = await (0, oauthHandler_1.createSession)('user-1', 'developer', store);
        const data = await (0, oauthHandler_1.getSession)(token, store);
        expect(data?.userId).toBe('user-1');
        expect(data?.role).toBe('developer');
    });
    it('returns null for an unknown token', async () => {
        const store = makeSessionStore();
        const data = await (0, oauthHandler_1.getSession)('nonexistent-token', store);
        expect(data).toBeNull();
    });
    it('returns null and deletes an expired session', async () => {
        const expiredData = {
            userId: 'user-expired',
            role: 'viewer',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() - 1000), // already expired
        };
        const store = makeSessionStore({ 'expired-token': expiredData });
        const data = await (0, oauthHandler_1.getSession)('expired-token', store);
        expect(data).toBeNull();
        // Verify it was deleted from the store
        expect(await store.get('expired-token')).toBeNull();
    });
});
// ─── handleOAuthCallback ──────────────────────────────────────────────────────
describe('handleOAuthCallback', () => {
    it('creates a session and returns a token for a new user', async () => {
        const store = makeSessionStore();
        const userRepo = makeUserRepo();
        const provider = makeOAuthProvider();
        const token = await (0, oauthHandler_1.handleOAuthCallback)('auth-code', 'state', store, userRepo, provider);
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
        const session = await (0, oauthHandler_1.getSession)(token, store);
        expect(session).not.toBeNull();
        expect(session?.role).toBe('viewer'); // default role
    });
    it('reuses an existing user and preserves their role', async () => {
        const existingUser = {
            id: 'existing-id',
            email: 'dev@example.com',
            role: 'admin',
            oauthProvider: 'google',
            oauthSubject: 'sub-1',
            createdAt: new Date(),
        };
        const store = makeSessionStore();
        const userRepo = makeUserRepo([existingUser]);
        const provider = makeOAuthProvider();
        const token = await (0, oauthHandler_1.handleOAuthCallback)('auth-code', 'state', store, userRepo, provider);
        const session = await (0, oauthHandler_1.getSession)(token, store);
        expect(session?.userId).toBe('existing-id');
        expect(session?.role).toBe('admin');
    });
});
// ─── buildAuthRedirectUrl ─────────────────────────────────────────────────────
describe('buildAuthRedirectUrl', () => {
    it('includes the original URL as redirect_uri', () => {
        const result = (0, oauthHandler_1.buildAuthRedirectUrl)('/dashboard', 'https://auth.example.com/oauth/authorize');
        expect(result).toContain('redirect_uri=%2Fdashboard');
    });
    it('preserves existing query params on the OAuth base URL', () => {
        const result = (0, oauthHandler_1.buildAuthRedirectUrl)('/breaks?severity=critical', 'https://auth.example.com/oauth/authorize?client_id=abc');
        expect(result).toContain('client_id=abc');
        expect(result).toContain('redirect_uri=');
    });
    it('encodes special characters in the original URL', () => {
        const result = (0, oauthHandler_1.buildAuthRedirectUrl)('/logs?q=error message', 'https://auth.example.com/oauth/authorize');
        expect(result).toContain('redirect_uri=');
        // URL should be properly encoded
        expect(result).not.toContain(' ');
    });
});
// ─── enforceHttps ─────────────────────────────────────────────────────────────
describe('enforceHttps', () => {
    const makeRes = () => {
        const res = {
            redirected: '',
            redirect(url) { this.redirected = url; },
            status(_code) { return { send(_body) { } }; },
        };
        return res;
    };
    it('calls next() when request is already HTTPS', () => {
        const req = { headers: { 'x-forwarded-proto': 'https', host: 'example.com' }, url: '/dashboard' };
        const res = makeRes();
        let nextCalled = false;
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        (0, oauthHandler_1.enforceHttps)(req, res, () => { nextCalled = true; });
        process.env.NODE_ENV = originalEnv;
        expect(nextCalled).toBe(true);
        expect(res.redirected).toBe('');
    });
    it('redirects HTTP to HTTPS in production', () => {
        const req = { headers: { 'x-forwarded-proto': 'http', host: 'example.com' }, url: '/dashboard' };
        const res = makeRes();
        let nextCalled = false;
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        (0, oauthHandler_1.enforceHttps)(req, res, () => { nextCalled = true; });
        process.env.NODE_ENV = originalEnv;
        expect(nextCalled).toBe(false);
        expect(res.redirected).toBe('https://example.com/dashboard');
    });
    it('calls next() in non-production even for HTTP', () => {
        const req = { headers: { 'x-forwarded-proto': 'http', host: 'localhost' }, url: '/' };
        const res = makeRes();
        let nextCalled = false;
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        (0, oauthHandler_1.enforceHttps)(req, res, () => { nextCalled = true; });
        process.env.NODE_ENV = originalEnv;
        expect(nextCalled).toBe(true);
    });
});
//# sourceMappingURL=oauthHandler.test.js.map