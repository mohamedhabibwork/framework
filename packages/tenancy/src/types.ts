/** Every interface and type of `@framework/tenancy`. Type-only. */
import type { Register } from '@framework/core';
import type { FrameworkEnv, PrincipalLike } from '@framework/http';
import type { Context } from 'hono';

/** The fields every tenant has. */
export interface BaseTenant {
  readonly id: string;
  readonly slug: string;
  readonly active: boolean;
}

/** `Register.tenant` when declared, else {@link BaseTenant}. */
export type RegisteredTenant = Register extends { readonly tenant: infer TTenant extends BaseTenant }
  ? TTenant
  : BaseTenant;

/** Reads a tenant's slug from a request, or null when this resolver finds none. */
export type TenantResolver = (c: Context<FrameworkEnv>) => string | null | Promise<string | null>;

/** Looks tenants up by the slug a resolver read. */
export interface TenantStore {
  findBySlug(slug: string): Promise<RegisteredTenant | null>;
  list(): Promise<readonly RegisteredTenant[]>;
}

/** Whether a signed-in principal belongs to a tenant. A slug comes from the client, so it proves nothing. */
export type TenantMembership = (
  principal: PrincipalLike,
  tenant: RegisteredTenant,
  c: Context<FrameworkEnv>,
) => boolean | Promise<boolean>;
