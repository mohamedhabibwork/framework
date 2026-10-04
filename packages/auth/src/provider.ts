import { type Application, defineProvider, type ServiceProvider } from '@framework/core';
import { DATABASE, type DatabaseConnection } from '@framework/database';
import type { ActorResolver } from '@framework/http';
import { AuthService } from './auth-service';
import { AUTH_SERVICE, PASSWORD_HASHER, SESSION_STORE, TOKEN_STORE, USER_PROVIDER } from './constants-tokens';
import { createAuthActorResolver } from './guard';
import { BunPasswordHasher } from './hashing';
import { PgSessionStore } from './session-store';
import { PgTokenStore } from './token-store';
import type { AuthConfig, AuthProviderOptions } from './types';
import { DatabaseUserProvider } from './user-provider';

export { AUTH_SERVICE, PASSWORD_HASHER, SESSION_STORE, TOKEN_STORE, USER_PROVIDER };

/**
 * Registers the auth stack as singletons over the database connection:
 * hasher, user provider, session/token stores and the `AuthService`.
 * Applications add it to their provider list after the database provider.
 */
export function createAuthProvider<TConfig extends { readonly auth: AuthConfig }>(
  options: AuthProviderOptions = {},
): ServiceProvider<TConfig> {
  return defineProvider<TConfig>({
    name: 'auth',
    dependsOn: ['database'],
    register({ container, config }) {
      const auth = config.auth;
      const connection = options.connection ?? DATABASE;
      container.singleton(PASSWORD_HASHER, () => new BunPasswordHasher());
      container.singleton(USER_PROVIDER, (r) => new DatabaseUserProvider(r.resolve<DatabaseConnection>(connection)));
      container.singleton(SESSION_STORE, (r) => new PgSessionStore(r.resolve<DatabaseConnection>(connection)));
      container.singleton(TOKEN_STORE, (r) => new PgTokenStore(r.resolve<DatabaseConnection>(connection)));
      container.singleton(
        AUTH_SERVICE,
        (r) =>
          new AuthService({
            hasher: r.resolve(PASSWORD_HASHER),
            users: r.resolve(USER_PROVIDER),
            sessions: r.resolve(SESSION_STORE),
            tokens: r.resolve(TOKEN_STORE),
            sessionTtlSeconds: auth.session.ttlSeconds,
            tokenTtlSeconds: auth.token.ttlSeconds,
          }),
      );
    },
  });
}

/**
 * The `resolveActor` implementation for `createHttpKernel`. Dependencies are
 * resolved from the container on first use (i.e. after boot), so composing
 * the HTTP application before boot stays legal.
 */
export function authActorResolver<TConfig extends { readonly auth: AuthConfig }>(
  application: Application<TConfig>,
): ActorResolver {
  let resolver: ActorResolver | undefined;
  return (c) => {
    resolver ??= createAuthActorResolver({
      config: application.config.auth,
      sessions: application.container.resolve(SESSION_STORE),
      tokens: application.container.resolve(TOKEN_STORE),
    });
    return resolver(c);
  };
}
