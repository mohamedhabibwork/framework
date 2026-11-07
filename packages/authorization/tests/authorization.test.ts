import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { Application, defineProvider } from '@framework/core';
import { createConnection, DATABASE, type DatabaseConnection } from '@framework/database';
import { createHttpKernel, HttpError, type PrincipalLike } from '@framework/http';
import { createTestDatabase, requireTestDatabaseUrl, type TestDatabase } from '@framework/testing';
import {
  type AuthorizationConfig,
  authorizationConfigSchema,
  authorizeAbility,
  createAuthorizationProvider,
  defineAbility,
  GATE,
  MemoryRoleStore,
  PgRoleStore,
  permissionPolicy,
  ROLE_STORE,
  RoleGate,
  type RoleStore,
  requirePermission,
} from '../src';

const session = (id: string): PrincipalLike => ({ id, abilities: ['*'] });
const roles = { admin: ['*'], editor: ['posts.publish', 'posts.view'], viewer: ['posts.view'] };
const gateWith = (assignments: Record<string, string[]>) => new RoleGate(new MemoryRoleStore(roles, assignments));

let database: TestDatabase;
let connection: DatabaseConnection;

beforeAll(async () => {
  database = await createTestDatabase({ adminUrl: requireTestDatabaseUrl() });
  connection = createConnection({ url: database.url, maxConnections: 4 });
  await connection.sql`create table users (id uuid primary key default gen_random_uuid())`;
  await connection.sql`create table authorization_roles (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now())`;
  await connection.sql`create table authorization_role_permissions (
    role_id uuid not null references authorization_roles(id) on delete cascade,
    permission text not null,
    primary key (role_id, permission))`;
  await connection.sql`create table authorization_user_roles (
    user_id uuid not null references users(id) on delete cascade,
    role_id uuid not null references authorization_roles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, role_id))`;
});

afterAll(async () => {
  await connection.close();
  await database.drop();
});

const newUser = async (): Promise<string> => {
  const rows = await connection.sql<{ id: string }[]>`insert into users default values returning id`;
  return rows[0]?.id as string;
};

describe('permissions', () => {
  test('a role grants what it lists, and nothing else', async () => {
    const gate = gateWith({ ada: ['editor'] });

    expect(await gate.can(session('ada'), 'posts.publish')).toBe(true);
    expect(await gate.can(session('ada'), 'users.manage')).toBe(false);
  });

  test('* in a role grants everything', async () => {
    expect(await gateWith({ ada: ['admin'] }).can(session('ada'), 'anything.at.all')).toBe(true);
  });

  test('no role, an unknown role, and no actor are all denied', async () => {
    const gate = gateWith({ ada: ['ghost'] });

    expect(await gate.can(session('nobody'), 'posts.view')).toBe(false);
    expect(await gate.can(session('ada'), 'posts.view')).toBe(false);
    expect(await gate.can(null, 'posts.view')).toBe(false);
    expect(await gate.can(undefined, 'posts.view')).toBe(false);
  });

  test('holding * as a principal grants nothing by itself', async () => {
    expect(await gateWith({}).can({ id: 'x', abilities: ['*'] }, 'posts.view')).toBe(false);
  });

  test("a scoped token can't use its owner's role beyond its scopes", async () => {
    const gate = gateWith({ ada: ['admin'] });

    expect(await gate.can({ id: 'ada', abilities: ['orders.view'] }, 'orders.view')).toBe(true);
    expect(await gate.can({ id: 'ada', abilities: ['orders.view'] }, 'users.manage')).toBe(false);
    expect(await gate.can({ id: 'ada', abilities: [] }, 'orders.view')).toBe(false);
  });

  test("a token's scope can't grant what its owner's roles don't", async () => {
    expect(await gateWith({ ada: ['viewer'] }).can({ id: 'ada', abilities: ['users.manage'] }, 'users.manage')).toBe(
      false,
    );
  });

  test('prototype keys are neither roles nor users', async () => {
    const gate = gateWith({ ada: ['constructor', '__proto__'] });

    expect(await gate.can(session('ada'), 'posts.view')).toBe(false);
    expect(await gate.can(session('constructor'), 'posts.view')).toBe(false);
    expect(await gate.can(session('__proto__'), 'posts.view')).toBe(false);
  });

  test('roles the principal carries count, through the same store', async () => {
    const gate = new RoleGate(new MemoryRoleStore(roles), {
      rolesOf: (actor) => (actor as PrincipalLike & { role: string }).role.split(','),
    });
    const editor = { id: 'x', abilities: ['*'], role: 'editor' };

    expect(await gate.can(editor, 'posts.publish')).toBe(true);
    expect(await gate.can(editor, 'users.manage')).toBe(false);
    expect(await gate.can({ ...editor, role: 'ghost' }, 'posts.view')).toBe(false);
  });

  test('one request reads its roles once, even with several checks', async () => {
    let reads = 0;
    const store: RoleStore = {
      permissionsFor: async () => {
        reads += 1;
        return ['a', 'b'];
      },
      permissionsOfRoles: async () => [],
    };
    const gate = new RoleGate(store);
    const principal = session('ada');

    await Promise.all([gate.can(principal, 'a'), gate.can(principal, 'b')]);
    await gate.can(principal, 'c');

    expect(reads).toBe(1);
    await gate.can(session('ada'), 'a');
    expect(reads).toBe(2);
  });

  test('a store failure is an error, never a pass or a remembered denial', async () => {
    let fail = true;
    const gate = new RoleGate({
      permissionsFor: async () => {
        if (fail) throw new Error('store down');
        return ['a'];
      },
      permissionsOfRoles: async () => [],
    });
    const principal = session('ada');

    await expect(gate.can(principal, 'a')).rejects.toThrow('store down');
    fail = false;
    expect(await gate.can(principal, 'a')).toBe(true);
  });
});

describe('abilities', () => {
  interface Post {
    readonly authorId: string;
  }
  const editPost = defineAbility<Post>('posts.edit', ({ actor, subject }) => subject.authorId === actor.id);
  const moderate = defineAbility<Post>(
    'posts.moderate',
    async ({ actor, subject, can }) => subject.authorId === actor.id || (await can('posts.moderate')),
  );

  test('checks the subject', async () => {
    const gate = gateWith({});

    expect(await gate.can(session('ada'), editPost, { authorId: 'ada' })).toBe(true);
    expect(await gate.can(session('ada'), editPost, { authorId: 'bob' })).toBe(false);
    expect(await gate.can(null, editPost, { authorId: 'ada' })).toBe(false);
  });

  test('can combine with permissions', async () => {
    const gate = new RoleGate(new MemoryRoleStore({ mod: ['posts.moderate'] }, { ada: ['mod'] }));

    expect(await gate.can(session('ada'), moderate, { authorId: 'bob' })).toBe(true);
    expect(await gate.can(session('bob'), moderate, { authorId: 'carol' })).toBe(false);
  });

  test("a scoped token can't pass an ability its scopes don't name", async () => {
    const gate = gateWith({});
    const own = { authorId: 'ada' };

    expect(await gate.can({ id: 'ada', abilities: ['billing.view'] }, editPost, own)).toBe(false);
    expect(await gate.can({ id: 'ada', abilities: [] }, editPost, own)).toBe(false);
    expect(await gate.can({ id: 'ada', abilities: ['posts.edit'] }, editPost, own)).toBe(true);
    expect(await gate.can({ id: 'ada', abilities: ['posts.edit'] }, editPost, { authorId: 'bob' })).toBe(false);
  });

  test('only a real true passes', async () => {
    const sloppy = defineAbility('sloppy', (() => 'yes') as never);
    const silent = defineAbility('silent', (() => undefined) as never);
    const gate = gateWith({});

    expect(await gate.can(session('ada'), sloppy)).toBe(false);
    expect(await gate.can(session('ada'), silent)).toBe(false);
  });

  test('a check that throws surfaces the error', async () => {
    const broken = defineAbility('broken', () => {
      throw new Error('bug');
    });

    await expect(gateWith({}).can(session('ada'), broken)).rejects.toThrow('bug');
  });
});

describe('authorize', () => {
  const statusOf = async (run: Promise<void>): Promise<number | 'passed'> =>
    run.then(
      () => 'passed' as const,
      (error: HttpError) => error.status,
    );

  test('401 without an actor, 403 without the right, and passes with it', async () => {
    const gate = gateWith({ ada: ['viewer'] });

    expect(await statusOf(gate.authorize(null, 'posts.view'))).toBe(401);
    expect(await statusOf(gate.authorize(session('ada'), 'users.manage'))).toBe(403);
    expect(await statusOf(gate.authorize(session('ada'), 'posts.view'))).toBe('passed');
  });

  test('errors are HttpErrors', async () => {
    await expect(gateWith({}).authorize(null, 'x')).rejects.toBeInstanceOf(HttpError);
  });
});

type Config = { readonly authorization: AuthorizationConfig };

const appFor = async (assignments: Record<string, string[]>) => {
  const authorization: AuthorizationConfig = { driver: 'config', roles, assignments };
  const app = new Application<Config>({
    config: { authorization },
    providers: [createAuthorizationProvider<Config>()],
  });
  await app.boot();
  const http = createHttpKernel(app, { exposeInternalErrors: false });
  http.use(async (c, next) => {
    const id = c.req.header('x-user');
    if (id) c.set('principal', session(id));
    await next();
  });
  const editOwn = defineAbility<{ authorId: string }>('edit', ({ actor, subject }) => actor.id === subject.authorId);
  http.get('/posts', requirePermission('posts.view'), (c) => c.json({ ok: true }));
  http.get(
    '/posts/:author',
    authorizeAbility(editOwn, (c) => ({ authorId: c.req.param('author') as string })),
    (c) => c.json({ ok: true }),
  );
  return { app, http };
};
const as = (user: string) => ({ headers: { 'x-user': user } });

describe('middleware', () => {
  test('requirePermission answers 401, 403 and 200', async () => {
    const { app, http } = await appFor({ ada: ['viewer'] });

    expect((await http.request('/posts')).status).toBe(401);
    expect((await http.request('/posts', as('bob'))).status).toBe(403);
    expect((await http.request('/posts', as('ada'))).status).toBe(200);
    await app.shutdown();
  });

  test('authorizeAbility checks the subject from the request', async () => {
    const { app, http } = await appFor({});

    expect((await http.request('/posts/ada')).status).toBe(401);
    expect((await http.request('/posts/ada', as('bob'))).status).toBe(403);
    expect((await http.request('/posts/ada', as('ada'))).status).toBe(200);
    await app.shutdown();
  });

  test('authorizeAbility denies a missing subject before its check can pass it', async () => {
    const { app, http } = await appFor({});
    let checked = false;
    const lenient = defineAbility<{ locked: boolean } | null>('lenient', ({ subject }) => {
      checked = true;
      return subject?.locked !== true;
    });
    http.get(
      '/missing',
      authorizeAbility(lenient, () => null),
      (c) => c.json({ ok: true }),
    );

    expect((await http.request('/missing', as('ada'))).status).toBe(403);
    expect(checked).toBe(false);
    await app.shutdown();
  });

  test('permissionPolicy maps resource abilities to permissions', async () => {
    const { app, http } = await appFor({ ada: ['editor'], root: ['admin'] });
    const policy = permissionPolicy('posts');
    const seen: Record<string, boolean> = {};
    http.get('/policy', async (c) => {
      seen.view = await policy.view(c as never);
      seen.delete = await policy.delete(c as never);
      return c.json({});
    });

    await http.request('/policy', as('ada'));
    expect(seen).toEqual({ view: true, delete: false });
    await http.request('/policy', as('root'));
    expect(seen).toEqual({ view: true, delete: true });
    await http.request('/policy');
    expect(seen).toEqual({ view: false, delete: false });
    await app.shutdown();
  });
});

const editableSuite = (name: string, create: () => PgRoleStore | MemoryRoleStore, user: () => Promise<string>) => {
  describe(name, () => {
    test('assigning, revoking and listing', async () => {
      const store = create();
      await store.syncRoles({ writer: ['a', 'b'] });
      const id = await user();

      await store.assign(id, 'writer');
      await store.assign(id, 'writer');

      expect(await store.rolesOf(id)).toEqual(['writer']);
      expect([...(await store.permissionsFor(id))].sort()).toEqual(['a', 'b']);
      expect(await store.revoke(id, 'writer')).toBe(true);
      expect(await store.revoke(id, 'writer')).toBe(false);
      expect(await store.permissionsFor(id)).toEqual([]);
    });

    test('assigning an unknown role is refused', async () => {
      const store = create();

      await expect(store.assign(await user(), 'ghost')).rejects.toMatchObject({ code: 'AUTHORIZATION_ROLE_UNKNOWN' });
    });

    test('sync makes a role hold exactly its list, keeps assignments, and is repeatable', async () => {
      const store = create();
      const id = await user();
      expect(await store.syncRoles({ syncer: ['a', 'b'] })).toEqual({ roles: 1, added: 2, removed: 0 });
      await store.assign(id, 'syncer');

      expect(await store.syncRoles({ syncer: ['b', 'c'] })).toEqual({ roles: 1, added: 1, removed: 1 });
      expect(await store.syncRoles({ syncer: ['b', 'c'] })).toEqual({ roles: 1, added: 0, removed: 0 });

      expect([...(await store.permissionsFor(id))].sort()).toEqual(['b', 'c']);
    });

    test('concurrent syncs of one role both finish', async () => {
      const store = create();

      await Promise.all([store.syncRoles({ racing: ['r'] }), store.syncRoles({ racing: ['r'] })]);

      expect(await store.permissionsOfRoles(['racing'])).toEqual(['r']);
    });

    test('permissions of roles by name', async () => {
      const store = create();
      await store.syncRoles({ named: ['n'] });

      expect(await store.permissionsOfRoles(['named', 'ghost'])).toEqual(['n']);
      expect(await store.permissionsOfRoles([])).toEqual([]);
    });
  });
};

editableSuite(
  'MemoryRoleStore',
  () => new MemoryRoleStore(),
  async () => crypto.randomUUID(),
);
editableSuite('PgRoleStore', () => new PgRoleStore(connection), newUser);

describe('PgRoleStore', () => {
  test('a removed user loses their assignments', async () => {
    const store = new PgRoleStore(connection);
    await store.syncRoles({ cascade: ['x'] });
    const id = await newUser();
    await store.assign(id, 'cascade');

    await connection.sql.unsafe('delete from users where id = $1', [id]);

    expect(await store.rolesOf(id)).toEqual([]);
  });
});

describe('provider', () => {
  test('the database driver uses the tables', async () => {
    const authorization: AuthorizationConfig = { driver: 'database', roles: {}, assignments: {} };
    const app = new Application<Config>({
      config: { authorization },
      providers: [
        defineProvider<Config>({
          name: 'database',
          register({ container }) {
            container.value(DATABASE, connection);
          },
        }),
        createAuthorizationProvider<Config>(),
      ],
    });
    await app.boot();
    const store = app.container.resolve(ROLE_STORE) as PgRoleStore;
    await store.syncRoles({ fromProvider: ['p'] });
    const id = await newUser();
    await store.assign(id, 'fromProvider');

    expect(await app.container.resolve(GATE).can(session(id), 'p')).toBe(true);
    await app.shutdown();
  });

  test('config defaults are empty, so everything is denied', () => {
    expect(authorizationConfigSchema.parse({})).toEqual({ driver: 'config', roles: {}, assignments: {} });
  });
});

describe('Register augmentation', () => {
  test('Register.permissions types the gate and middleware', async () => {
    const typecheck = Bun.spawn(['bunx', 'tsc', '-p', 'tsconfig.json'], {
      cwd: join(import.meta.dir, 'fixtures/register'),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(typecheck.stdout).text(),
      new Response(typecheck.stderr).text(),
      typecheck.exited,
    ]);

    expect(`${code}: ${stdout}${stderr}`).toBe('0: ');
  }, 120_000);
});
