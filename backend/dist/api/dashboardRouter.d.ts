/**
 * Dashboard Aggregation REST API Router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import type { Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
export interface DashboardRepository {
    countBreaks(windowHours: number): Promise<number>;
    getErrorRateTrend(windowHours: number, bucketHours: number): Promise<Array<{
        timestamp: Date;
        count: number;
    }>>;
    getTopServices(limit: number): Promise<Array<{
        applicationId: string;
        count: number;
    }>>;
    getTimeSeries(granularity: 'hourly' | 'daily', from: Date, to: Date): Promise<Array<{
        timestamp: Date;
        count: number;
    }>>;
    getSeverityBreakdown(): Promise<Record<string, number>>;
    getDeploymentEvents?(): Promise<Array<{
        timestamp: Date;
        applicationId: string;
        version: string;
    }>>;
}
export interface DashboardRequest {
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
export interface DashboardResponse {
    statusCode: number;
    status(code: number): DashboardResponse;
    json(body: unknown): void;
}
export type NextFn = () => void;
export type DashboardHandler = (req: DashboardRequest, res: DashboardResponse, next: NextFn) => Promise<void>;
/**
 * GET /dashboard — returns aggregated metrics.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export declare function createGetDashboardHandler(repo: DashboardRepository): DashboardHandler;
export declare function createDashboardRouter(dashboardRepo: DashboardRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository): Promise<any>;
export declare function createDashboardRouterSync(dashboardRepo: DashboardRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware): any;
