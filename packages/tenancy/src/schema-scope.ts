import { FrameworkError } from '@framework/core';
import type { TransactionContext } from '@framework/database';
import { sql } from 'drizzle-orm';
import { requireTenant } from './context';

const SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** The Postgres schema a tenant's data lives in. */
export function tenantSchemaName(slug: string): string {
  const name = `tenant_${slug.replaceAll('-', '_')}`;
  if (!SCHEMA_NAME.test(name)) throw new FrameworkError('TENANT_SCHEMA_INVALID', 'Not a usable tenant schema name');
  return name;
}

/**
 * Runs `work` in a transaction whose `search_path` is the current tenant's schema. The
 * setting ends with the transaction, so a pooled connection can't carry it to another
 * request. Unqualified table names then resolve inside that schema only.
 */
export const runInTenantSchema = <T>(transactions: TransactionContext, work: () => Promise<T>): Promise<T> =>
  transactions.transaction(async () => {
    const schema = tenantSchemaName(requireTenant().slug);
    await transactions.executor.execute(sql`select set_config('search_path', ${schema}, true)`);
    return work();
  });
