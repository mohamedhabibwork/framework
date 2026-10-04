/**
 * Every interface and type alias of `@framework/auth` in one place.
 * Runtime values (classes, tokens, functions) live in their own modules.
 */

import type { DatabaseConnection, SelectOf } from '@framework/database';

// -- Configuration -----------------------------------------------------------

export type AuthGuardName = 'session' | 'api-token';

/** Validated `auth` section of the application configuration. */
export interface AuthConfig {
  /** Guards consulted in order; the first match wins. */
  readonly guards: readonly AuthGuardName[];
  readonly session: {
    /** Cookie name carrying the opaque session token. */
    readonly cookie: string;
    /** Sliding lifetime: every authenticated use extends to a full window. */
    readonly ttlSeconds: number;
    /** Emit the Secure cookie attribute (enable in production). */
    readonly secure: boolean;
  };
  readonly token: {
    /** Default lifetime after issuance; null means tokens do not expire. */
    readonly ttlSeconds: number | null;
  };
}

// -- Records -----------------------------------------------------------------

/** Row of the framework-owned `users` table. */
export type UserRecord = SelectOf<typeof import('./schema/tables').users>;

/** Row of the framework-owned `sessions` table (never carries the token hash). */
export type SessionRecord = Omit<SelectOf<typeof import('./schema/tables').sessions>, 'tokenHash'>;

/** Row of the framework-owned `api_tokens` table (never carries the token hash). */
export type ApiTokenRecord = Omit<SelectOf<typeof import('./schema/tables').apiTokens>, 'tokenHash'>;

/** A session row joined with its user, as returned by `SessionStore.find`. */
export interface ResolvedSession {
  readonly session: SessionRecord;
  readonly user: UserRecord;
}

// -- Principal ----------------------------------------------------------------

/**
 * Authenticated identity installed on the request context. Structurally
 * satisfies `@framework/http`'s `PrincipalLike`. Session principals hold
 * `['*']` abilities; API token principals carry their declared abilities.
 */
export interface Principal {
  readonly id: string;
  readonly via: AuthGuardName;
  readonly abilities: readonly string[];
  readonly user: UserRecord;
  /** Present when `via` is `session`. */
  readonly sessionId?: string;
  /** Present when `via` is `api-token`. */
  readonly tokenId?: string;
}

// -- Contracts ----------------------------------------------------------------

/** Password hashing abstraction (argon2id in production, fakes in tests). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

/**
 * Loads and creates principals. Applications with a custom user store swap
 * this out (`create` backs the default registration route and must persist
 * the already-hashed password).
 */
export interface UserProvider {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(input: { readonly name: string; readonly email: string; readonly passwordHash: string }): Promise<UserRecord>;
}

export interface IssuedSession {
  readonly session: SessionRecord;
  /** Plaintext cookie value; shown once, only the hash is persisted. */
  readonly token: string;
}

/**
 * Server-side session state: creation, resolution (expiry-filtered, user
 * joined), rotation on login, revocation and pruning.
 */
export interface SessionStore {
  create(userId: string, ttlSeconds: number): Promise<IssuedSession>;
  find(token: string): Promise<ResolvedSession | null>;
  /** Invalidates `currentToken` and creates a fresh session in one transaction. */
  rotate(currentToken: string, ttlSeconds: number): Promise<IssuedSession | null>;
  revoke(token: string): Promise<boolean>;
  revokeById(id: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<number>;
  /** Sliding renewal: extends expiry to a fresh window and marks last use. */
  touch(id: string, ttlSeconds: number): Promise<void>;
  /** Removes expired sessions; returns the number deleted. */
  prune(now?: Date): Promise<number>;
}

export interface IssuedToken {
  readonly token: ApiTokenRecord;
  /** Plaintext `prefix…` value; shown once, only the hash is persisted. */
  readonly plaintext: string;
}

/**
 * Personal API tokens: hashed at rest, ability-scoped, expirable and
 * revocable. `find` only resolves unrevoked, unexpired tokens.
 */
export interface ApiTokenStore {
  issue(userId: string, name: string, abilities: readonly string[], ttlSeconds: number | null): Promise<IssuedToken>;
  find(plaintext: string): Promise<{ readonly token: ApiTokenRecord; readonly user: UserRecord } | null>;
  listForUser(userId: string): Promise<readonly ApiTokenRecord[]>;
  /** Revokes only when the token belongs to `userId`. */
  revoke(id: string, userId: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<number>;
  touch(id: string): Promise<void>;
}

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface AttemptResult {
  readonly user: UserRecord;
  readonly sessionId: string;
  readonly sessionToken: string;
}

export interface IssueTokenInput {
  readonly name: string;
  readonly abilities?: readonly string[];
  /** Overrides the configured default lifetime for this token. */
  readonly ttlSeconds?: number | null;
}

/**
 * The `AuthService` class (see ./auth-service) is both implementation and
 * public contract; its dependencies are defined here for tests and fakes.
 */
export interface AuthServiceDeps {
  readonly hasher: PasswordHasher;
  readonly users: UserProvider;
  readonly sessions: SessionStore;
  readonly tokens: ApiTokenStore;
  readonly sessionTtlSeconds: number;
  readonly tokenTtlSeconds: number | null;
}

/** Options for `createAuthProvider` (see provider.ts). */
export interface AuthProviderOptions {
  /** Connection token to build stores on; defaults to `DATABASE`. */
  readonly connection?: Token<DatabaseConnection>;
}

/** Options for `createAuthActorResolver` (see guard.ts). */
export interface AuthGuardDeps {
  readonly config: AuthConfig;
  readonly sessions: SessionStore;
  readonly tokens: ApiTokenStore;
}

import type { Token } from '@framework/core';
import type { MiddlewareHandler } from 'hono';
import type { AuthService } from './auth-service';

export type { AuthService };

/** Options for `defineAuthRoutes` (see routes.ts). */
export interface AuthRoutesDeps {
  /** DI token of the bound `AuthService` (resolved from the request scope). */
  readonly service: Token<AuthService>;
  readonly session: Pick<AuthConfig['session'], 'cookie' | 'ttlSeconds' | 'secure'>;
  /**
   * Native Hono CSRF middleware guarding the cookie flows. Applications with
   * browser clients pass `csrf({ origin: [...corsOrigins] })`; the default
   * checks same-origin only. JSON clients are unaffected (Hono only
   * challenges form-encoded content types).
   */
  readonly csrf?: MiddlewareHandler;
}
