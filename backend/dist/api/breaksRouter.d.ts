/**
 * Breaks REST API Router
 * Requirements: 2.1, 4.1, 4.2, 4.3, 4.4
 */
import type { Break, LogRecord, Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
import { BreakExportRepository } from './logsRouter';
export interface BreakFilters {
    status?: string;
    severity?: string;
    applicationId?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
}
export interface BreakRepository {
    findAll(filters: BreakFilters): Promise<{
        data: Break[];
        total: number;
    }>;
    findById(id: string): Promise<Break | null>;
}
export interface LogRepository {
    findCorrelated(applicationId: string, from: Date, to: Date): Promise<LogRecord[]>;
}
export interface BreaksRequest {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
    ip?: string;
    query: Record<string, string | undefined>;
    params: Record<string, string>;
    session?: {
        userId: string;
        role: Role;
    };
}
export interface BreaksResponse {
    statusCode: number;
    status(code: number): BreaksResponse;
    json(body: unknown): void;
}
export type NextFn = () => void;
export type BreaksHandler = (req: BreaksRequest, res: BreaksResponse, next: NextFn) => Promise<void>;
/**
 * GET /breaks — paginated, filterable list.
 * Requirements: 2.1, 4.3
 */
export declare function createListBreaksHandler(breakRepo: BreakRepository): BreaksHandler;
/**
 * GET /breaks/:id — detail with correlated logs.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export declare function createGetBreakHandler(breakRepo: BreakRepository, logRepo: LogRepository): BreaksHandler;
/**
 * Creates an Express Router with RBAC applied to all breaks endpoints.
 * Lazily imports express so the module can be tested without express installed.
 */
export declare function createBreaksRouter(breakRepo: BreakRepository, logRepo: LogRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, breakExportRepo?: BreakExportRepository): Promise<any>;
/**
 * Synchronous version for use when express is already loaded.
 */
export declare function createBreaksRouterSync(breakRepo: BreakRepository, logRepo: LogRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware, breakExportRepo?: BreakExportRepository): any;
