"use strict";
/**
 * RBAC Middleware
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = hasPermission;
exports.createRbacMiddleware = createRbacMiddleware;
const VIEWER_PERMISSIONS = [
    { method: 'GET', pathPrefix: '/breaks' },
    { method: 'GET', pathPrefix: '/logs' },
    { method: 'GET', pathPrefix: '/dashboard' },
    { method: 'GET', pathPrefix: '/filters' },
    { method: 'GET', pathPrefix: '/alerts' },
    { method: 'GET', pathPrefix: '/applications' },
];
const DEVELOPER_EXTRA_PERMISSIONS = [
    { method: 'POST', pathPrefix: '/alerts' },
    { method: 'PUT', pathPrefix: '/alerts' },
    { method: 'DELETE', pathPrefix: '/alerts' },
    { method: 'POST', pathPrefix: '/filters' },
    { method: 'PUT', pathPrefix: '/filters' },
    { method: 'DELETE', pathPrefix: '/filters' },
];
const ADMIN_EXTRA_PERMISSIONS = [
    { method: 'GET', pathPrefix: '/users' },
    { method: 'POST', pathPrefix: '/users' },
    { method: 'PUT', pathPrefix: '/users' },
    { method: 'DELETE', pathPrefix: '/users' },
    { method: 'GET', pathPrefix: '/retention' },
    { method: 'PUT', pathPrefix: '/retention' },
    { method: 'POST', pathPrefix: '/applications' },
];
const ROLE_PERMISSIONS = {
    viewer: VIEWER_PERMISSIONS,
    developer: [...VIEWER_PERMISSIONS, ...DEVELOPER_EXTRA_PERMISSIONS],
    admin: [...VIEWER_PERMISSIONS, ...DEVELOPER_EXTRA_PERMISSIONS, ...ADMIN_EXTRA_PERMISSIONS],
};
// ─── Pure Permission Check ────────────────────────────────────────────────────
/**
 * Pure function: returns true if the given role is allowed to access
 * the given HTTP method + path combination.
 *
 * Exported for testability (Property 15).
 */
function hasPermission(role, method, path) {
    const rules = ROLE_PERMISSIONS[role];
    if (!rules)
        return false;
    const upperMethod = method.toUpperCase();
    return rules.some((rule) => (rule.method === '*' || rule.method === upperMethod) &&
        (path === rule.pathPrefix || path.startsWith(rule.pathPrefix + '/') || path.startsWith(rule.pathPrefix + '?')));
}
// ─── Token Extraction ─────────────────────────────────────────────────────────
function extractToken(req) {
    // 1. Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearerToken = headerValue?.startsWith('Bearer ') ? headerValue.slice(7).trim() : undefined;
    if (bearerToken)
        return bearerToken;
    // 2. Cookie: session=<token>
    const cookieToken = req.cookies?.['session'];
    if (cookieToken) {
        return cookieToken;
    }
    return null;
}
// ─── Middleware Factory ───────────────────────────────────────────────────────
/**
 * Creates an Express-compatible RBAC middleware using dependency injection.
 *
 * - Returns 401 for missing or invalid/expired session tokens.
 * - Returns 403 (and writes to audit log) for valid sessions with insufficient role.
 * - Attaches session data to `req.session` and calls `next()` on success.
 */
function createRbacMiddleware(sessionStore, auditLogRepo) {
    return async (req, res, next) => {
        const token = extractToken(req);
        // 401 — no token provided
        if (!token) {
            res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
            return;
        }
        // Resolve session
        const { getSession } = await Promise.resolve().then(() => __importStar(require('./oauthHandler')));
        const session = await getSession(token, sessionStore);
        // 401 — token invalid or expired
        if (!session) {
            res.status(401).json({ error: 'Unauthorized', message: 'Session invalid or expired.' });
            return;
        }
        // Check role permission
        if (!hasPermission(session.role, req.method, req.path)) {
            // Write to audit log (Requirement 6.6)
            await auditLogRepo.log({
                userId: session.userId,
                action: `${req.method} ${req.path}`,
                resource: req.path,
                outcome: 'denied',
                ipAddress: req.ip,
            });
            res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions.' });
            return;
        }
        // Attach session to request and proceed
        req.session = { userId: session.userId, role: session.role };
        next();
    };
}
//# sourceMappingURL=rbac.js.map