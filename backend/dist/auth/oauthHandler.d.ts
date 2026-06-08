/**
 * OAuth 2.0 / OIDC Authentication Handler
 * Requirements: 7.1, 7.2, 7.4
 */
import { Role, User } from '@portal/shared';
export interface SessionData {
    userId: string;
    role: Role;
    createdAt: Date;
    expiresAt: Date;
}
export interface SessionStore {
    get(token: string): Promise<SessionData | null>;
    set(token: string, data: SessionData, ttlSeconds: number): Promise<void>;
    delete(token: string): Promise<void>;
}
export interface UserRepository {
    findByOAuthSubject(provider: string, subject: string): Promise<User | null>;
    save(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
}
export interface OAuthTokens {
    accessToken: string;
    idToken?: string;
}
export interface OAuthUserInfo {
    subject: string;
    email: string;
    provider: string;
}
export interface OAuthProvider {
    exchangeCode(code: string): Promise<OAuthTokens>;
    getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}
/**
 * Creates a new session for the given user, stores it in Redis, and returns
 * the session token.
 */
export declare function createSession(userId: string, role: Role, sessionStore: SessionStore): Promise<string>;
/**
 * Retrieves session data for the given token. Returns null if the session
 * is missing or expired.
 */
export declare function getSession(token: string, sessionStore: SessionStore): Promise<SessionData | null>;
/**
 * Handles the OAuth callback: exchanges the authorization code for tokens,
 * fetches user info, creates or updates the user record, and creates a session.
 * Returns the session token.
 */
export declare function handleOAuthCallback(code: string, _state: string, sessionStore: SessionStore, userRepo: UserRepository, oauthProvider: OAuthProvider): Promise<string>;
/**
 * Builds the OAuth redirect URL, preserving the originally requested URL as
 * the `redirect_uri` query parameter so the user is returned there after login.
 * Requirement 7.4
 */
export declare function buildAuthRedirectUrl(originalUrl: string, oauthBaseUrl: string): string;
/**
 * Express-compatible middleware that enforces HTTPS for all requests.
 * Redirects HTTP requests to their HTTPS equivalent.
 * Requirement 7.2
 */
export declare function enforceHttps(req: {
    headers: Record<string, string | string[] | undefined>;
    url: string;
}, res: {
    redirect(url: string): void;
    status(code: number): {
        send(body: string): void;
    };
}, next: () => void): void;
