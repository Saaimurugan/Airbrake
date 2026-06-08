/**
 * Admin REST API Router — User Management & Retention Policies
 * Requirements: 6.1, 6.5, 9.1
 */
import type { User, RetentionPolicy, Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
export interface UserRepository {
    findAll(): Promise<User[]>;
    create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
    update(id: string, user: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null>;
    delete(id: string): Promise<boolean>;
}
export interface RetentionPolicyRepository {
    findAll(): Promise<RetentionPolicy[]>;
    upsert(policy: RetentionPolicy): Promise<RetentionPolicy>;
}
export interface AdminRequest {
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
export interface AdminResponse {
    statusCode: number;
    status(code: number): AdminResponse;
    json(body: unknown): void;
    send(): void;
}
export type NextFn = () => void;
export type AdminHandler = (req: AdminRequest, res: AdminResponse, next: NextFn) => Promise<void>;
/**
 * GET /users — list all users (Admin only).
 * Requirements: 6.1
 */
export declare function listUsersHandler(repo: UserRepository): AdminHandler;
/**
 * POST /users — create a user (Admin only).
 * Requirements: 6.1
 */
export declare function createUserHandler(repo: UserRepository): AdminHandler;
/**
 * PUT /users/:id — update a user (Admin only).
 * Requirements: 6.1
 */
export declare function updateUserHandler(repo: UserRepository): AdminHandler;
/**
 * DELETE /users/:id — delete a user (Admin only).
 * Requirements: 6.1
 */
export declare function deleteUserHandler(repo: UserRepository): AdminHandler;
/**
 * GET /retention — list retention policies (Admin only).
 * Requirements: 9.1
 */
export declare function listRetentionPoliciesHandler(repo: RetentionPolicyRepository): AdminHandler;
/**
 * PUT /retention — upsert a retention policy (Admin only).
 * Requirements: 9.1
 */
export declare function upsertRetentionPolicyHandler(repo: RetentionPolicyRepository): AdminHandler;
export declare function createAdminRouterSync(userRepo: UserRepository, retentionRepo: RetentionPolicyRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware): any;
