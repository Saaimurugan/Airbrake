"use strict";
/**
 * Property-based tests for RBAC enforcement
 * Feature: live-airbrake-monitoring-portal, Property 15: RBAC Enforcement
 * Feature: live-airbrake-monitoring-portal, Property 16: Unauthenticated Access Rejection
 *
 * Validates: Requirements 5.5, 6.3, 6.4, 6.5, 6.6, 7.1
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
const fc = __importStar(require("fast-check"));
const rbac_1 = require("../rbac");
// Mock the dynamic import of oauthHandler inside createRbacMiddleware
jest.mock('../oauthHandler', () => ({
    ...jest.requireActual('../oauthHandler'),
    getSession: jest.fn(),
}));
const oauthHandler = __importStar(require("../oauthHandler"));
// ─── Arbitraries ──────────────────────────────────────────────────────────────
const writeMethods = fc.constantFrom('POST', 'PUT', 'DELETE');
const anyMethod = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');
// Endpoints that viewers cannot write to
const writeRestrictedPaths = fc.constantFrom('/alerts', '/filters', '/users', '/retention');
// Endpoints that developers cannot access at all
const developerRestrictedPaths = fc.constantFrom('/users', '/retention');
// Viewer read-only endpoints
const viewerReadPaths = fc.constantFrom('/breaks', '/logs', '/dashboard');
// ─── Property 15: RBAC Enforcement ───────────────────────────────────────────
// Feature: live-airbrake-monitoring-portal, Property 15: RBAC Enforcement
describe('Property 15: RBAC Enforcement', () => {
    it('viewer is denied any write operation on /alerts, /filters, /users, /retention', () => {
        fc.assert(fc.property(writeMethods, writeRestrictedPaths, (method, path) => {
            expect((0, rbac_1.hasPermission)('viewer', method, path)).toBe(false);
        }), { numRuns: 100 });
    });
    it('developer is denied any operation on /users and /retention', () => {
        fc.assert(fc.property(anyMethod, developerRestrictedPaths, (method, path) => {
            // Developer has no access to /users or /retention at all
            // (admin-only endpoints)
            expect((0, rbac_1.hasPermission)('developer', method, path)).toBe(false);
        }), { numRuns: 100 });
    });
    it('admin is allowed all operations that viewer, developer, or admin-extra permissions grant', () => {
        // Admin inherits all viewer + developer + admin-extra permissions.
        // We verify that every permission granted to viewer or developer is also
        // granted to admin (i.e., admin is a superset of all lower roles).
        const viewerAllowedCombinations = fc.constantFrom(['GET', '/breaks'], ['GET', '/logs'], ['GET', '/dashboard'], ['GET', '/filters'], ['GET', '/alerts'], ['GET', '/applications']);
        const developerAllowedCombinations = fc.constantFrom(['POST', '/alerts'], ['PUT', '/alerts'], ['DELETE', '/alerts'], ['POST', '/filters'], ['PUT', '/filters'], ['DELETE', '/filters']);
        const adminOnlyCombinations = fc.constantFrom(['GET', '/users'], ['POST', '/users'], ['PUT', '/users'], ['DELETE', '/users'], ['GET', '/retention'], ['PUT', '/retention'], ['POST', '/applications']);
        const allGrantedCombinations = fc.oneof(viewerAllowedCombinations, developerAllowedCombinations, adminOnlyCombinations);
        fc.assert(fc.property(allGrantedCombinations, ([method, path]) => {
            expect((0, rbac_1.hasPermission)('admin', method, path)).toBe(true);
        }), { numRuns: 100 });
    });
    it('viewer read operations on /breaks, /logs, /dashboard are always allowed', () => {
        fc.assert(fc.property(viewerReadPaths, (path) => {
            expect((0, rbac_1.hasPermission)('viewer', 'GET', path)).toBe(true);
        }), { numRuns: 100 });
    });
});
// ─── Property 16: Unauthenticated Access Rejection ───────────────────────────
// Feature: live-airbrake-monitoring-portal, Property 16: Unauthenticated Access Rejection
/**
 * Validates: Requirements 7.1
 */
describe('Property 16: Unauthenticated Access Rejection', () => {
    // Session store that always returns null (no valid session)
    const nullSessionStore = {
        get: async (_token) => null,
        set: async () => { },
        delete: async () => { },
    };
    const noopAuditLog = {
        log: async () => { },
    };
    const httpMethods = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS');
    const protectedPaths = fc.constantFrom('/breaks', '/logs', '/dashboard', '/alerts', '/filters', '/users', '/retention', '/applications');
    beforeEach(() => {
        // getSession always returns null — simulates no valid session
        oauthHandler.getSession.mockResolvedValue(null);
    });
    it('returns 401 and never calls next() for requests with no token', async () => {
        await fc.assert(fc.asyncProperty(httpMethods, protectedPaths, async (method, path) => {
            const middleware = (0, rbac_1.createRbacMiddleware)(nullSessionStore, noopAuditLog);
            let statusCode;
            let nextCalled = false;
            const req = {
                headers: {},
                method,
                path,
            };
            const res = {
                status(code) {
                    statusCode = code;
                    return this;
                },
                json(_body) { },
            };
            const next = () => {
                nextCalled = true;
            };
            await middleware(req, res, next);
            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
        }), { numRuns: 100 });
    });
    it('returns 401 and never calls next() for requests with an invalid/expired token', async () => {
        const arbitraryToken = fc.string({ minLength: 1, maxLength: 128 });
        await fc.assert(fc.asyncProperty(httpMethods, protectedPaths, arbitraryToken, async (method, path, token) => {
            const middleware = (0, rbac_1.createRbacMiddleware)(nullSessionStore, noopAuditLog);
            let statusCode;
            let nextCalled = false;
            const req = {
                headers: { authorization: `Bearer ${token}` },
                method,
                path,
            };
            const res = {
                status(code) {
                    statusCode = code;
                    return this;
                },
                json(_body) { },
            };
            const next = () => {
                nextCalled = true;
            };
            await middleware(req, res, next);
            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=rbac.property.test.js.map