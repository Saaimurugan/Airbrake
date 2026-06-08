/**
 * Logs REST API Router
 * Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.5, 9.4
 */
import type { Break, LogRecord, Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
export interface LogSearchFilters {
    keyword?: string;
    tags?: string[];
    severity?: string;
    applicationId?: string;
    environment?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
}
export interface BreakExportFilters {
    severity?: string;
    applicationId?: string;
    from?: Date;
    to?: Date;
}
export interface LogSearchRepository {
    search(filters: LogSearchFilters): Promise<{
        data: LogRecord[];
        total: number;
    }>;
    searchAll(filters: Omit<LogSearchFilters, 'page' | 'limit'>): Promise<LogRecord[]>;
}
export interface BreakExportRepository {
    exportAll(filters: BreakExportFilters): Promise<Break[]>;
}
export interface LogsRequest {
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
export interface LogsResponse {
    statusCode: number;
    status(code: number): LogsResponse;
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
    send(body: string): void;
}
export type NextFn = () => void;
export type LogsHandler = (req: LogsRequest, res: LogsResponse, next: NextFn) => Promise<void>;
/**
 * Minimal CSV serializer.
 * Produces a header row followed by one row per record.
 */
export declare function toCsv(records: object[], fields: string[]): string;
/**
 * GET /logs — paginated, filterable log search.
 * Requirements: 1.4, 1.5, 8.1, 8.2
 */
export declare function createSearchLogsHandler(logRepo: LogSearchRepository): LogsHandler;
/**
 * GET /logs/export — export all matching logs as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
export declare function createExportLogsHandler(logRepo: LogSearchRepository): LogsHandler;
/**
 * GET /breaks/export — export all matching breaks as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
export declare function createExportBreaksHandler(breakExportRepo: BreakExportRepository): LogsHandler;
/**
 * Creates an Express Router for /logs endpoints with RBAC applied.
 */
export declare function createLogsRouter(logRepo: LogSearchRepository, breakExportRepo: BreakExportRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository): Promise<any>;
/**
 * Synchronous version for use when express is already loaded.
 */
export declare function createLogsRouterSync(logRepo: LogSearchRepository, breakExportRepo: BreakExportRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware): any;
