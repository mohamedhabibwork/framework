import { AsyncLocalStorage } from 'node:async_hooks';
import { FrameworkError } from '@framework/core';
import type { RegisteredTenant } from './types';

const storage = new AsyncLocalStorage<RegisteredTenant>();

/** Runs `work` as a tenant. Everything it awaits sees that tenant. */
export const runWithTenant = <T>(tenant: RegisteredTenant, work: () => T): T => storage.run(tenant, work);

/** The current tenant, or null outside one. */
export const currentTenant = (): RegisteredTenant | null => storage.getStore() ?? null;

/** The current tenant, or an error: tenant-owned data must never be touched without one. */
export function requireTenant(): RegisteredTenant {
  const tenant = storage.getStore();
  if (!tenant) throw new FrameworkError('TENANT_REQUIRED', 'This needs a tenant, and none is active');
  return tenant;
}

/**
 * A key or path inside the current tenant, for cache, search and storage. Each part
 * of the result is the tenant's id, so one tenant's slug can't reach another's keys.
 */
export const tenantKey = (key: string): string => `tenants/${requireTenant().id}/${key}`;
