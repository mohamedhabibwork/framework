// Public API of @framework/auth.
// Convention: every interface/type lives in `./types`, every constant in
// `./constants`; runtime values (classes, tokens, functions) stay in their modules.
export { AuthService } from './auth-service';
export {
  AUTH_RATE_LIMITER,
  AUTH_SERVICE,
  authConfigSchema,
  defaultAuthConfig,
  PASSWORD_HASHER,
  SESSION_STORE,
  SESSION_TOUCH_INTERVAL_MS,
  TOKEN_STORE,
  USER_PROVIDER,
} from './constants';
export { createAuthActorResolver } from './guard';
export { BunPasswordHasher } from './hashing';
export { requireAbility, requireAuth } from './middleware';
export { authPrincipal, hasAbility } from './principals';
export { authActorResolver, createAuthProvider } from './provider';
export { createTokenSchema, defineAuthRoutes, loginSchema, publicUser, registerSchema } from './routes';
export type { ApiTokenRow, SessionRow, UserRow } from './schema/tables';
export { apiTokens, sessions, users } from './schema/tables';
export { generateSessionToken, hashToken, PgSessionStore } from './session-store';
export { generateApiToken, hashApiToken, PgTokenStore } from './token-store';
// Grouped conventions: every type in ./types, every constant in ./constants.
export type {
  ApiTokenRecord,
  ApiTokenStore,
  AttemptResult,
  AuthConfig,
  AuthGuardDeps,
  AuthGuardName,
  AuthProviderOptions,
  AuthRoutesDeps,
  AuthServiceDeps,
  IssuedSession,
  IssuedToken,
  IssueTokenInput,
  PasswordHasher,
  Principal,
  RegisterInput,
  ResolvedSession,
  SessionRecord,
  SessionStore,
  UserProvider,
  UserRecord,
} from './types';
export { DatabaseUserProvider } from './user-provider';
