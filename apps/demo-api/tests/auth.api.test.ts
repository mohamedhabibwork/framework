import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createTestContext, type TestContext } from './support';

/**
 * End-to-end auth integration for `apps/demo-api`, installed by `make:auth`.
 *
 * Proves the acceptance path against a **real migrated PostgreSQL database**
 * (via `@framework/testing`): register (session cookie) -> `me` (session) ->
 * issue a personal API token (plaintext shown once) -> `me` authenticated by
 * that Bearer token. The auth tables ship as `0001_create-auth-tables.sql`.
 */
const SESSION_COOKIE = 'fw_session';

/** Extracts the framework session cookie value from a `Set-Cookie` header. */
const sessionCookie = (response: Response): string | undefined =>
  response.headers
    .get('set-cookie')
    ?.split(';')
    .find((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');

const jsonPost = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
});

const credentials = {
  name: 'Ada Lovelace',
  email: 'ada@demo-api.test',
  password: 'correct horse battery staple',
};

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
}, 120_000);

afterAll(async () => {
  await ctx?.close();
});

describe('demo-api auth integration', () => {
  let cookie = '';
  let plaintext = '';

  test('POST /api/v1/auth/register creates the user and starts a session', async () => {
    const response = await ctx.client.request('/api/v1/auth/register', jsonPost(credentials));
    expect(response.status).toBe(201);

    const body = (await response.json()) as { user: Record<string, unknown> };
    expect(body.user.email).toBe(credentials.email);
    expect(body.user.name).toBe(credentials.name);
    // The public projection never leaks the password hash.
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('totpSecret');

    cookie = sessionCookie(response) ?? '';
    expect(cookie).not.toBe('');
  });

  test('GET /api/v1/auth/me authenticates the session cookie', async () => {
    const response = await ctx.client.request('/api/v1/auth/me', {
      headers: { cookie: `${SESSION_COOKIE}=${cookie}` },
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { via: string; abilities: readonly string[] };
    expect(body.via).toBe('session');
    expect(body.abilities).toContain('*');
  });

  test('GET /api/v1/auth/me without credentials is 401', async () => {
    const response = await ctx.client.request('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  test('POST /api/v1/auth/tokens issues a personal API token (plaintext shown once)', async () => {
    const response = await ctx.client.request(
      '/api/v1/auth/tokens',
      jsonPost({ name: 'ci', abilities: ['*'] }, { cookie: `${SESSION_COOKIE}=${cookie}` }),
    );
    expect(response.status).toBe(201);

    const body = (await response.json()) as { value: string; token: { id: string; name: string } };
    expect(typeof body.value).toBe('string');
    expect(body.value.length).toBeGreaterThan(0);
    expect(body.token.name).toBe('ci');
    plaintext = body.value;
  });

  test('the issued token authenticates a request as api-token', async () => {
    const response = await ctx.client.request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { via: string; user: { email: string } };
    expect(body.via).toBe('api-token');
    expect(body.user.email).toBe(credentials.email);
  });
});
