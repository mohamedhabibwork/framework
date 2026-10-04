import { toIsoTimestamp, toIsoTimestampOrNull } from '@framework/database';
import { type FrameworkEnv, notFound, resolve, tooManyRequests, unauthenticated } from '@framework/http';
import { validate } from '@framework/validation';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { csrf } from 'hono/csrf';
import type { CookieOptions } from 'hono/utils/cookie';
import { z } from 'zod/v4';
import { defaultAuthConfig } from './config-schema';
import { requireAuth } from './middleware';
import { authPrincipal } from './principals';
import type { ApiTokenRecord, AuthRoutesDeps, UserRecord } from './types';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(120),
  abilities: z.array(z.string().min(1)).min(1).default(['*']),
  ttlSeconds: z.number().int().positive().nullable().optional(),
});

/** Public projection — `passwordHash` and raw timestamps never leave. */
export const publicUser = (user: UserRecord) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerifiedAt: toIsoTimestampOrNull(user.emailVerifiedAt),
  createdAt: toIsoTimestamp(user.createdAt),
  updatedAt: toIsoTimestamp(user.updatedAt),
});

const publicToken = (token: ApiTokenRecord) => ({
  id: token.id,
  name: token.name,
  abilities: token.abilities,
  expiresAt: toIsoTimestampOrNull(token.expiresAt),
  lastUsedAt: toIsoTimestamp(token.lastUsedAt),
  createdAt: toIsoTimestamp(token.createdAt),
});

const cookieOptions = (deps: AuthRoutesDeps): CookieOptions => ({
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  secure: deps.session.secure,
  maxAge: deps.session.ttlSeconds,
});

/** Fixed-window counter key: failures are counted per lowercased email. */
const loginKey = (email: string) => `login:${email.toLowerCase()}`;

/**
 * Framework auth endpoints (register/login/logout/me + personal API token
 * management). Mounted by the application, e.g. `.route('/auth', …)` under
 * the API prefix. Credentials are only ever accepted over the JSON body.
 *
 * Login throttling is active only when a `rateLimiter` is injected and
 * `rateLimit.enabled` — either missing leaves the endpoint unlimited, an
 * explicit configuration choice, never a silent bypass. The flow counts
 * failures only: one `consume` per login serves as both the pre-verification
 * check and the failure registration, and a successful login `reset`s the
 * window, so successes never eat into the allowance. Blocked callers get
 * `TOO_MANY_REQUESTS` (429) with a `Retry-After` header before any
 * credential work.
 *
 * CSRF (native Hono middleware) guards the cookie flows only — Bearer-token
 * routes are immune to CSRF, so they accept plain JSON clients without an
 * origin check.
 */
export function defineAuthRoutes(deps: AuthRoutesDeps): Hono<FrameworkEnv> {
  const service = (c: Parameters<typeof resolve>[0]) => resolve(c, deps.service);
  const cookie = cookieOptions(deps);
  const cookieFlow = deps.csrf ?? csrf();
  const rateLimit = deps.rateLimit ?? defaultAuthConfig.rateLimit;
  const limiter = deps.rateLimiter && rateLimit.enabled ? deps.rateLimiter : undefined;

  return new Hono<FrameworkEnv>()
    .post('/register', cookieFlow, validate('json', registerSchema), async (c) => {
      const user = await service(c).register(c.req.valid('json'));
      const session = await service(c).startSession(user.id);
      setCookie(c, deps.session.cookie, session.sessionToken, cookie);
      return c.json({ user: publicUser(user) }, 201);
    })
    .post('/login', cookieFlow, validate('json', loginSchema), async (c) => {
      const input = c.req.valid('json');
      const key = loginKey(input.email);
      if (limiter) {
        const verdict = await limiter.consume(key, rateLimit.maxAttempts, rateLimit.windowSeconds);
        if (!verdict.allowed) {
          c.header('Retry-After', String(verdict.retryAfterSeconds));
          throw tooManyRequests();
        }
      }
      const result = await service(c).attempt(input.email, input.password);
      if (!result) throw unauthenticated('Invalid credentials');
      if (limiter) await limiter.reset(key);
      setCookie(c, deps.session.cookie, result.sessionToken, cookie);
      return c.json({ user: publicUser(result.user) }, 200);
    })
    .post('/logout', cookieFlow, requireAuth(), async (c) => {
      const principal = authPrincipal(c);
      if (principal) await service(c).logout(principal);
      deleteCookie(c, deps.session.cookie, { path: '/' });
      return c.body(null, 204);
    })
    .get('/me', requireAuth(), (c) => {
      const principal = authPrincipal(c);
      if (!principal) throw unauthenticated();
      return c.json({ user: publicUser(principal.user), via: principal.via, abilities: principal.abilities }, 200);
    })
    .post('/tokens', requireAuth(), validate('json', createTokenSchema), async (c) => {
      const principal = authPrincipal(c);
      if (!principal) throw unauthenticated();
      const issued = await service(c).issueToken(principal.user, c.req.valid('json'));
      // The plaintext value appears exactly once, in this response.
      return c.json({ token: publicToken(issued.token), value: issued.plaintext }, 201);
    })
    .get('/tokens', requireAuth(), async (c) => {
      const principal = authPrincipal(c);
      if (!principal) throw unauthenticated();
      return c.json({ tokens: (await service(c).listTokens(principal.id)).map(publicToken) }, 200);
    })
    .delete('/tokens/:id', requireAuth(), async (c) => {
      const principal = authPrincipal(c);
      if (!principal) throw unauthenticated();
      if (!(await service(c).revokeToken(c.req.param('id'), principal.id))) throw notFound('Token not found');
      return c.body(null, 204);
    });
}
