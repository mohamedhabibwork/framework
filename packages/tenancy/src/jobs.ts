import type { JsonObject, JsonValue } from '@framework/core';
import type { JobDefinition } from '@framework/queue';
import { z } from 'zod/v4';
import { requireTenant, runWithTenant } from './context';
import type { TenantStore } from './types';

type TenantPayload<TPayload extends JsonObject> = TPayload & { readonly tenantId: string };

/**
 * A job that runs as the tenant that dispatched it. `withTenant(payload)` adds the current
 * tenant when dispatching, and the worker re-reads it from the store, so a tenant removed or
 * deactivated in the meantime fails the job rather than running it.
 */
export function tenantJob<TPayload extends JsonObject, TResult extends JsonValue>(
  definition: JobDefinition<TPayload, TResult>,
  store: Pick<TenantStore, 'list'>,
): {
  readonly job: JobDefinition<TenantPayload<TPayload>, TResult>;
  withTenant(payload: TPayload): TenantPayload<TPayload>;
} {
  const job = {
    ...definition,
    payload: z
      .intersection(definition.payload, z.object({ tenantId: z.string().min(1) }))
      .transform((value) => value as TenantPayload<TPayload>) as unknown as z.ZodType<TenantPayload<TPayload>>,
    async handle(payload: TenantPayload<TPayload>, context: Parameters<typeof definition.handle>[1]) {
      const tenant = (await store.list()).find(({ id }) => id === payload.tenantId);
      if (!tenant?.active) throw new Error(`Tenant ${payload.tenantId} is not active`);
      return runWithTenant(tenant, () => definition.handle(payload, context));
    },
  } as JobDefinition<TenantPayload<TPayload>, TResult>;
  return { job, withTenant: (payload) => ({ ...payload, tenantId: requireTenant().id }) };
}
