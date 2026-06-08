/**
 * RBAC Middleware
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1
 */
import { Role } from '@portal/shared';
import { SessionStore } from './oauthHandler';
export interface AuditLogEntry {
    userId: string | null;
    action: string;
    resource: string;
    outcome: 'allowed' | 'denied';
    ipAddress?: string;
}
export interface AuditLogRepository {
    log(entry: AuditLogEntry): Promise<void>;
}
/**
 * Pure function: returns true if the given role is allowed to access
 * the given HTTP method + path combination.
 *
 * Exported for testability (Property 15).
 */
export declare function hasPermission(role: Role, method: string, path: string): boolean;
export interface RbacRequest {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
    method: string;
    path: string;
    ip?: string;
    session?: {
        userId: string;
        role: Role;
    };
}
export interface RbacResponse {
    status(code: number): RbacResponse;
    json(body: unknown): void;
}
export type NextFunction = () => void;
export type RbacMiddleware = (req: RbacRequest, res: RbacResponse, next: NextFunction) => Promise<void>;
/**
 * Creates an Express-compatible RBAC middleware using dependency injection.
 *
 * - Returns 401 for missing or invalid/expired session tokens.
 * - Returns 403 (and writes to audit log) for valid sessions with insufficient role.
 * - Attaches session data to `req.session` and calls `next()` on success.
 */
export declare function createRbacMiddleware(sessionStore: SessionStore, auditLogRepo: AuditLogRepository): RbacMiddleware;
