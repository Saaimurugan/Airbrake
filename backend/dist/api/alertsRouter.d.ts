/**
 * Alert Rules REST API Router
 * Requirements: 5.5
 */
import type { AlertRule, Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
export interface AlertRuleRepository {
    create(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
    findAll(): Promise<AlertRule[]>;
    findById(id: string): Promise<AlertRule | null>;
    update(id: string, rule: Partial<Omit<AlertRule, 'id'>>): Promise<AlertRule | null>;
    delete(id: string): Promise<boolean>;
}
export interface AlertsRequest {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
    ip?: string;
    query: Record<string, string | undefined>;
    params: Record<string, string>;
    body?: unknown;
    session?: {
        userId: string;
        role: Role;
    };
}
export interface AlertsResponse {
    statusCode: number;
    status(code: number): AlertsResponse;
    json(body: unknown): void;
    send(): void;
}
export type NextFn = () => void;
export type AlertsHandler = (req: AlertsRequest, res: AlertsResponse, next: NextFn) => Promise<void>;
/**
 * POST /alerts — create an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export declare function createAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler;
/**
 * GET /alerts — list all alert rules (Viewer+).
 * Requirements: 5.5
 */
export declare function listAlertRulesHandler(repo: AlertRuleRepository): AlertsHandler;
/**
 * PUT /alerts/:id — update an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export declare function updateAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler;
/**
 * DELETE /alerts/:id — delete an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export declare function deleteAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler;
export declare function createAlertsRouterSync(alertRepo: AlertRuleRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware): any;
