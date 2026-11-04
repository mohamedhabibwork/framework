import type { RepositoryConstructor } from '@framework/database';
import { eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { requireTenant } from './context';

type WriteHooks = {
  beforeCreate(values: object): object;
  beforeUpdate(changes: object): object;
};

/**
 * Scopes a repository to the current tenant: every read, update and delete filters on
 * `column`, and creates stamp it whatever the caller sent. With no tenant active it
 * throws rather than running unscoped.
 *
 * ```ts
 * class OrderRepository extends TenantScoped(BaseRepository<typeof orders>, 'tenantId') {}
 * ```
 */
export function TenantScoped<TBase extends RepositoryConstructor>(Base: TBase, column: string) {
  abstract class TenantScopedRepository extends Base {
    #tenantColumn(): AnyPgColumn {
      const found = (this.table as unknown as Readonly<Record<string, AnyPgColumn>>)[column];
      if (!found) throw new Error(`TenantScoped: "${column}" is not a column of this table`);
      return found;
    }

    override scopeConditions(): SQL[] {
      return [...super.scopeConditions(), eq(this.#tenantColumn(), requireTenant().id)];
    }

    protected beforeCreate(values: object): object {
      const hooks = Base.prototype as unknown as WriteHooks;
      return { ...hooks.beforeCreate.call(this, values), [column]: requireTenant().id };
    }

    /** A row can't be moved to another tenant. */
    protected beforeUpdate(changes: object): object {
      const hooks = Base.prototype as unknown as WriteHooks;
      const { [column]: _ignored, ...rest } = hooks.beforeUpdate.call(this, changes) as Record<string, unknown>;
      return rest;
    }
  }
  return TenantScopedRepository as unknown as TBase;
}
