import type { TenantResolver } from './types';

/** `acme.example.com` with base domain `example.com` is `acme`. Only one label deep, and never the base itself. */
export const subdomainResolver =
  (baseDomain: string): TenantResolver =>
  (c) => {
    const host = (c.req.header('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
    const suffix = `.${baseDomain.toLowerCase()}`;
    if (!host.endsWith(suffix)) return null;
    const label = host.slice(0, -suffix.length);
    return label && !label.includes('.') ? label : null;
  };

export const headerResolver =
  (name = 'x-tenant'): TenantResolver =>
  (c) =>
    c.req.header(name) ?? null;

/** The path segment at `index` (`/acme/orders` at 0 is `acme`). */
export const pathResolver =
  (index = 0): TenantResolver =>
  (c) =>
    c.req.path.split('/').filter(Boolean)[index] ?? null;
