import { defineProvider, type ServiceProvider, type Token } from '@framework/core';
import { DATABASE, type DatabaseConnection } from '@framework/database';
import { z } from 'zod/v4';
import { GATE, ROLE_STORE } from './constants';
import { type GateOptions, RoleGate } from './gate';
import { MemoryRoleStore, PgRoleStore } from './stores';
import type { AuthorizationConfig } from './types';

/** Validated shape of the application's `authorization` configuration section. */
export const authorizationConfigSchema = z.object({
  driver: z.enum(['config', 'memory', 'database']).default('config'),
  roles: z.record(z.string().min(1), z.array(z.string().min(1))).default({}),
  assignments: z.record(z.string().min(1), z.array(z.string().min(1))).default({}),
});

export interface AuthorizationProviderOptions extends GateOptions {
  /** Connection token for the `database` driver; defaults to `DATABASE`. */
  readonly connection?: Token<DatabaseConnection>;
}

/** Registers the gate and the configured role store. */
export function createAuthorizationProvider<TConfig extends { readonly authorization: AuthorizationConfig }>(
  options: AuthorizationProviderOptions = {},
): ServiceProvider<TConfig> {
  return defineProvider<TConfig>({
    name: 'authorization',
    register({ container, config }) {
      const { driver, roles, assignments } = config.authorization;
      const connection = options.connection ?? DATABASE;
      container.singleton(ROLE_STORE, (r) =>
        driver === 'database'
          ? new PgRoleStore(r.resolve<DatabaseConnection>(connection))
          : new MemoryRoleStore(roles, assignments),
      );
      container.singleton(GATE, (r) => new RoleGate(r.resolve(ROLE_STORE), options));
    },
  });
}
