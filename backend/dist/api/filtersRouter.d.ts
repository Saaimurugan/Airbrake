/**
 * Saved Filters REST API Router
 * Requirements: 8.3, 8.4
 */
import type { SavedFilter, Role } from '@portal/shared';
import { AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
export interface SavedFilterRepository {
    create(filter: Omit<SavedFilter, 'id'>): Promise<SavedFilter>;
    findById(id: string): Promise<SavedFilter | null>;
    update(id: string, filter: Partial<Omit<SavedFilter, 'id'>>): Promise<SavedFilter | null>;
    delete(id: string): Promise<boolean>;
}
export interface FiltersRequest {
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
export interface FiltersResponse {
    statusCode: number;
    status(code: number): FiltersResponse;
    json(body: unknown): void;
    send(): void;
}
export type NextFn = () => void;
export type FiltersHandler = (req: FiltersRequest, res: FiltersResponse, next: NextFn) => Promise<void>;
/**
 * POST /filters — create a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export declare function createSavedFilterHandler(repo: SavedFilterRepository): FiltersHandler;
/**
 * GET /filters/:id — get a saved filter by id (Viewer+).
 * Requirements: 8.3
 */
export declare function getFilterHandler(repo: SavedFilterRepository): FiltersHandler;
/**
 * PUT /filters/:id — update a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export declare function updateFilterHandler(repo: SavedFilterRepository): FiltersHandler;
/**
 * DELETE /filters/:id — delete a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export declare function deleteFilterHandler(repo: SavedFilterRepository): FiltersHandler;
export declare function createFiltersRouterSync(filterRepo: SavedFilterRepository, sessionStore: SessionStore, auditLogRepo: AuditLogRepository, rbacMiddleware?: RbacMiddleware): any;
