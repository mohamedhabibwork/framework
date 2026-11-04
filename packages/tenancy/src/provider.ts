import { defineProvider, type ServiceProvider, type Token } from '@framework/core';
import { DATABASE, type DatabaseConnection } from '@framework/database';
import { TENANT_STORE } from './constants';
import { PgTenantStore } from './stores';

/** Binds the PostgreSQL tenant store. Override `TENANT_STORE` to keep tenants elsewhere. */
export function createTenancyProvider<TConfig extends object>(
  options: { readonly connection?: Token<DatabaseConnection> } = {},
): ServiceProvider<TConfig> {
  return defineProvider<TConfig>({
    name: 'tenancy',
    register({ container }) {
      const connection = options.connection ?? DATABASE;
      container.singleton(TENANT_STORE, (r) => new PgTenantStore(r.resolve<DatabaseConnection>(connection)));
    },
  });
}
