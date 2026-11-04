import { currentPrincipal, type FrameworkEnv, forbidden, notFound, resolve } from '@framework/http';
import { createMiddleware } from 'hono/factory';
import { TENANT_STORE } from './constants';
import { runWithTenant } from './context';
import type { TenantMembership, TenantResolver } from './types';

export interface TenancyOptions {
  /** Tried in order; the first to read a slug decides. */
  readonly resolvers: readonly TenantResolver[];
  /**
   * Who may act in a tenant. Required: a resolver only reads what the client sent, so
   * without this any signed-in user could reach any tenant. `'any'` opts out explicitly.
   */
  readonly member: TenantMembership | 'any';
}

/**
 * Resolves the tenant and runs the rest of the request as it. A request with no tenant,
 * or an unknown or inactive one, is a 404, so slugs can't be probed. Mount it after
 * whatever installs the principal.
 */
export const tenancyMiddleware = (options: TenancyOptions) =>
  createMiddleware<FrameworkEnv>(async (c, next) => {
    let slug: string | null = null;
    for (const resolver of options.resolvers) {
      slug = await resolver(c);
      if (slug) break;
    }
    const tenant = slug ? await resolve(c, TENANT_STORE).findBySlug(slug) : null;
    if (!tenant?.active) throw notFound('Unknown tenant');
    const principal = currentPrincipal(c);
    if (principal && options.member !== 'any' && (await options.member(principal, tenant, c)) !== true) {
      throw forbidden();
    }
    await runWithTenant(tenant, next);
  });
