"use strict";
/**
 * OAuth 2.0 / OIDC Authentication Handler
 * Requirements: 7.1, 7.2, 7.4
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.getSession = getSession;
exports.handleOAuthCallback = handleOAuthCallback;
exports.buildAuthRedirectUrl = buildAuthRedirectUrl;
exports.enforceHttps = enforceHttps;
const node_crypto_1 = __importDefault(require("node:crypto"));
// ─── Session TTL ──────────────────────────────────────────────────────────────
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
// ─── Core Functions ───────────────────────────────────────────────────────────
/**
 * Creates a new session for the given user, stores it in Redis, and returns
 * the session token.
 */
async function createSession(userId, role, sessionStore) {
    const token = node_crypto_1.default.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const sessionData = {
        userId,
        role,
        createdAt: now,
        expiresAt,
    };
    await sessionStore.set(token, sessionData, SESSION_TTL_SECONDS);
    return token;
}
/**
 * Retrieves session data for the given token. Returns null if the session
 * is missing or expired.
 */
async function getSession(token, sessionStore) {
    const data = await sessionStore.get(token);
    if (!data)
        return null;
    // Guard against sessions that slipped past Redis TTL
    if (new Date() > new Date(data.expiresAt)) {
        await sessionStore.delete(token);
        return null;
    }
    return data;
}
/**
 * Handles the OAuth callback: exchanges the authorization code for tokens,
 * fetches user info, creates or updates the user record, and creates a session.
 * Returns the session token.
 */
async function handleOAuthCallback(code, _state, sessionStore, userRepo, oauthProvider) {
    const tokens = await oauthProvider.exchangeCode(code);
    const userInfo = await oauthProvider.getUserInfo(tokens.accessToken);
    let user = await userRepo.findByOAuthSubject(userInfo.provider, userInfo.subject);
    user ?? (user = await userRepo.save({
        email: userInfo.email,
        role: 'viewer', // default role for new users
        oauthProvider: userInfo.provider,
        oauthSubject: userInfo.subject,
    }));
    return createSession(user.id, user.role, sessionStore);
}
/**
 * Builds the OAuth redirect URL, preserving the originally requested URL as
 * the `redirect_uri` query parameter so the user is returned there after login.
 * Requirement 7.4
 */
function buildAuthRedirectUrl(originalUrl, oauthBaseUrl) {
    const url = new URL(oauthBaseUrl);
    url.searchParams.set('redirect_uri', originalUrl);
    return url.toString();
}
/**
 * Express-compatible middleware that enforces HTTPS for all requests.
 * Redirects HTTP requests to their HTTPS equivalent.
 * Requirement 7.2
 */
function enforceHttps(req, res, next) {
    const proto = req.headers['x-forwarded-proto'];
    const isHttps = proto === 'https' ||
        (Array.isArray(proto) && proto[0] === 'https');
    if (!isHttps && process.env.NODE_ENV === 'production') {
        const host = req.headers['host'];
        res.redirect(`https://${host}${req.url}`);
        return;
    }
    next();
}
//# sourceMappingURL=oauthHandler.js.map