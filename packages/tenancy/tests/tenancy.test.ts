import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Application, defineProvider, EXECUTION_CONTEXT, FrameworkError } from '@framework/core';
import { defineResource } from '@framework/crud';
import {
  BaseSoftDeletableRepository,
  createConnection,
  DATA_CONTEXT,
  DATABASE,
  type DatabaseConnection,
  TRANSACTION_CONTEXT,
  TransactionContext,
} from '@framework/database';
import { defineApp, type PrincipalLike } from '@framework/http';
import type { Operation } from '@framework/openapi';
import { defineJob } from '@framework/queue';
import { createTestDatabase, requireTestDatabaseUrl, type TestDatabase } from '@framework/testing';
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod/v4';
import {
  currentTenant,
  headerResolver,
  MemoryTenantStore,
  pathResolver,
  PgTenantStore,
  requireTenant,
  runInTenantSchema,
  runWithTenant,
  subdomainResolver,
  TENANT_STORE,
  tenancyMiddleware,
  tenantJob,
  tenantKey,
  TenantScoped,
  tenantSchemaName,
} from '../src';

const orders = pgTable('tenancy_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
});

class OrderRepository extends TenantScoped(BaseSoftDeletableRepository<typeof orders>, 'tenantId') {}

const acme = { id: 'tenant-acme', slug: 'acme', active: true };
const globex = { id: 'tenant-globex', slug: 'globex', active: true };
const closed = { id: 'tenant-closed', slug: 'closed', active: false };
const store = new MemoryTenantStore([acme, globex, closed]);

let database: TestDatabase;
let connection: DatabaseConnection;

beforeAll(async () => {
  database = await createTestDatabase({ adminUrl: requireTestDatabaseUrl() });
  connection = createConnection({ url: database.url, maxConnections: 4 });
  await connection.sql`create table tenancy_orders (
    id uuid primary key default gen_random_uuid(),
    tenant_id text not null,
    title text not null,
    deleted_at timestamptz)`;
});

afterAll(async () => {
  await connection.close();
  await database.drop();
});

const buildHttp = async (member: Parameters<typeof tenancyMiddleware>[0]['member'] = 'any') => {
  const resource = defineResource(orders, {
    access: 'public',
    name: 'Order',
    path: '/orders',
    softDelete: true,
    hidden: ['tenantId'],
    repository: OrderRepository as never,
  });
  const app = defineApp<object, Operation>({
    http: () => ({ exposeInternalErrors: false }),
    middleware: () => [
      async (c, next) => {
        const user = c.req.header('x-user');
        if (user) c.set('principal', { id: user, abilities: ['*'] } satisfies PrincipalLike);
        await next();
      },
      tenancyMiddleware({ resolvers: [headerResolver()], member }),
    ],
    providers: [
      defineProvider<object>({
        name: 'database',
        register({ container }) {
          container.singleton(DATABASE, () => connection);
          container.value(TENANT_STORE, store);
          container.scoped(TRANSACTION_CONTEXT, (r) => new TransactionContext(r.resolve(DATABASE).db));
          container.scoped(DATA_CONTEXT, (r) => ({
            transactions: r.resolve(TRANSACTION_CONTEXT),
            execution: r.resolve(EXECUTION_CONTEXT),
          }));
        },
      }),
    ],
    modules: [resource],
  });
  const application = await new Application<object>({ config: {}, providers: app.providers }).boot();
  return { application, http: app.createHttp(application) };
};

const as = (slug: string, init: RequestInit = {}) => ({ ...init, headers: { ...init.headers, 'x-tenant': slug } });
const create = (slug: string, body: object) =>
  as(slug, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('two tenants in one database', () => {
  test('neither can see, change, remove or restore the other’s rows', async () => {
    const { application, http } = await buildHttp();
    const created = (await (await http.request('/api/v1/orders', create('acme', { title: 'Acme order' }))).json()) as {
      id: string;
    };
    const path = `/api/v1/orders/${created.id}`;

    const [stored] = await connection.sql<
      { tenant_id: string }[]
    >`select tenant_id from tenancy_orders where id = ${created.id}`;
    expect(stored?.tenant_id).toBe(acme.id);
    expect((await http.request(path, as('acme'))).status).toBe(200);
    expect((await http.request(path, as('globex'))).status).toBe(404);

    const list = (await (await http.request('/api/v1/orders', as('globex'))).json()) as { items: unknown[] };
    expect(list.items).toEqual([]);

    const patch = (slug: string, body: object) =>
      as(slug, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await http.request(path, patch('globex', { title: 'Hacked' }))).status).toBe(404);
    expect((await http.request(path, as('globex', { method: 'DELETE' }))).status).toBe(404);

    expect((await http.request(path, as('acme', { method: 'DELETE' }))).status).toBe(204);
    expect((await http.request(`${path}/restore`, as('globex', { method: 'POST' }))).status).toBe(404);
    expect((await http.request(`/api/v1/orders/deleted/${created.id}`, as('globex'))).status).toBe(404);
    expect((await http.request(`${path}/restore`, as('acme', { method: 'POST' }))).status).toBe(200);
    await application.shutdown();
  });

  test('a client cannot write a row into another tenant', async () => {
    const context = {
      transactions: new TransactionContext(connection.db),
      execution: { actor: { id: null, type: 'system' }, correlationId: 'c' },
    } as never;
    const repository = new OrderRepository(orders, context);

    const row = await runWithTenant(acme, () => repository.create({ title: 'Mine', tenantId: globex.id }));
    expect(row.tenantId).toBe(acme.id);

    const moved = await runWithTenant(acme, () => repository.update(row.id, { tenantId: globex.id, title: 'Renamed' }));
    expect(moved).toMatchObject({ tenantId: acme.id, title: 'Renamed' });
  });

  test('with no tenant active, a repository throws rather than running unscoped', async () => {
    const context = { transactions: new TransactionContext(connection.db), execution: {} } as never;
    const repository = new OrderRepository(orders, context);

    await expect(repository.findMany()).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    await expect(repository.create({ title: 'x', tenantId: 'x' })).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  test('concurrent requests keep their own tenant', async () => {
    const seen = await Promise.all(
      [acme, globex, acme, globex].map((tenant) =>
        runWithTenant(tenant, async () => {
          await Bun.sleep(5);
          return requireTenant().id;
        }),
      ),
    );

    expect(seen).toEqual([acme.id, globex.id, acme.id, globex.id]);
    expect(currentTenant()).toBeNull();
  });
});

describe('resolving a tenant', () => {
  test('a request with no tenant, an unknown one or an inactive one is a 404', async () => {
    const { application, http } = await buildHttp();

    expect((await http.request('/api/v1/orders')).status).toBe(404);
    expect((await http.request('/api/v1/orders', as('nope'))).status).toBe(404);
    expect((await http.request('/api/v1/orders', as('closed'))).status).toBe(404);
    await application.shutdown();
  });

  test('a signed-in principal must belong to the tenant', async () => {
    const { application, http } = await buildHttp((principal, tenant) => principal.id === `${tenant.slug}-user`);
    const signedIn = (slug: string, user: string) => ({ headers: { 'x-tenant': slug, 'x-user': user } });

    expect((await http.request('/api/v1/orders', signedIn('acme', 'acme-user'))).status).toBe(200);
    expect((await http.request('/api/v1/orders', signedIn('globex', 'acme-user'))).status).toBe(403);
    await application.shutdown();
  });

  test('a membership check must really return true', async () => {
    const { application, http } = await buildHttp((() => 'yes') as never);

    expect((await http.request('/api/v1/orders', { headers: { 'x-tenant': 'acme', 'x-user': 'u' } })).status).toBe(403);
    await application.shutdown();
  });

  const contextWith = (host: string, path = '/') =>
    ({ req: { header: (name: string) => (name === 'host' ? host : undefined), path } }) as never;

  test('subdomains are one label under the base domain', () => {
    const resolve = subdomainResolver('example.com');

    expect(resolve(contextWith('acme.example.com'))).toBe('acme');
    expect(resolve(contextWith('ACME.example.com:8080'))).toBe('acme');
    expect(resolve(contextWith('example.com'))).toBeNull();
    expect(resolve(contextWith('a.b.example.com'))).toBeNull();
    expect(resolve(contextWith('acme.example.com.evil.net'))).toBeNull();
    expect(resolve(contextWith('evilexample.com'))).toBeNull();
  });

  test('paths use the requested segment', () => {
    expect(pathResolver()(contextWith('x', '/acme/orders'))).toBe('acme');
    expect(pathResolver(1)(contextWith('x', '/t/acme'))).toBe('acme');
    expect(pathResolver(5)(contextWith('x', '/t'))).toBeNull();
  });
});

describe('keys', () => {
  test('are inside the tenant, and need one', () => {
    expect(runWithTenant(acme, () => tenantKey('cart'))).toBe(`tenants/${acme.id}/cart`);
    expect(() => tenantKey('cart')).toThrow(FrameworkError);
  });
});

describe('schema per tenant', () => {
  test('each tenant reads its own schema, and the setting ends with the transaction', async () => {
    for (const tenant of [acme, globex]) {
      const schema = tenantSchemaName(tenant.slug);
      await connection.sql.unsafe(`create schema ${schema}`);
      await connection.sql.unsafe(`create table ${schema}.notes (body text)`);
      await connection.sql.unsafe(`insert into ${schema}.notes values ('${tenant.slug} note')`);
    }
    const transactions = new TransactionContext(connection.db);
    const read = (tenant: typeof acme) =>
      runWithTenant(tenant, () =>
        runInTenantSchema(transactions, () => transactions.executor.execute(sql`select body from notes`)),
      );

    expect([...(await read(acme))]).toEqual([{ body: 'acme note' }]);
    expect([...(await read(globex))]).toEqual([{ body: 'globex note' }]);
    await expect((async () => connection.db.execute(sql`select body from notes`))()).rejects.toThrow();
  });

  test('a slug that could not be a safe schema name is refused', () => {
    expect(tenantSchemaName('my-shop')).toBe('tenant_my_shop');
    for (const slug of ['a"; drop schema public; --', 'UPPER', 'a b', 'x'.repeat(100)]) {
      expect(() => tenantSchemaName(slug)).toThrow(FrameworkError);
    }
  });
});

describe('jobs', () => {
  const definition = defineJob({
    name: 'tenancy.echo',
    version: 1,
    payload: z.object({ value: z.string() }),
    handle: async ({ value }) => ({ value, tenant: requireTenant().id }),
  });
  const { job, withTenant } = tenantJob(definition, store);

  test('run as the tenant that dispatched them', async () => {
    const payload = runWithTenant(acme, () => withTenant({ value: 'v' }));

    expect(await job.handle(job.payload.parse(payload), {} as never)).toEqual({ value: 'v', tenant: acme.id });
  });

  test('dispatching needs a tenant, and a removed or inactive one fails the job', async () => {
    expect(() => withTenant({ value: 'v' })).toThrow(FrameworkError);
    await expect(job.handle({ value: 'v', tenantId: closed.id }, {} as never)).rejects.toThrow('not active');
    await expect(job.handle({ value: 'v', tenantId: 'gone' }, {} as never)).rejects.toThrow('not active');
  });

  test('a payload without a tenant is invalid', () => {
    expect(job.payload.safeParse({ value: 'v' }).success).toBe(false);
  });
});

describe('PgTenantStore', () => {
  test('reads tenants by slug', async () => {
    await connection.sql`create table tenants (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      active boolean not null default true,
      created_at timestamptz not null default now())`;
    await connection.sql`insert into tenants (slug) values ('stored')`;
    const pg = new PgTenantStore(connection);

    expect(await pg.findBySlug('stored')).toMatchObject({ slug: 'stored', active: true });
    expect(await pg.findBySlug('nope')).toBeNull();
    expect(await pg.list()).toHaveLength(1);
  });
});
