import { FrameworkError } from '@framework/core';

/** Structural subset of Hono's `app.routes`, independent of the app's Env generic. */
interface RouteTable {
  readonly routes: readonly { readonly method: string; readonly path: string }[];
}

export interface RouteInfo {
  readonly method: string;
  readonly path: string;
  /** Handlers (route middleware + final handler) registered for this method/path. */
  readonly handlers: number;
}

/** Lists endpoint routes (excluding `use()` middleware entries) in registration order. */
export function listRoutes(app: RouteTable): RouteInfo[] {
  const routes = new Map<string, RouteInfo>();
  for (const route of app.routes) {
    if (route.method === 'ALL') continue;
    const key = `${route.method} ${route.path}`;
    routes.set(key, { method: route.method, path: route.path, handlers: (routes.get(key)?.handlers ?? 0) + 1 });
  }
  return [...routes.values()];
}

/**
 * Hono records one table entry per handler, so a single `app.get(path, mw, h)`
 * produces a contiguous run of entries. A method+path that appears in two
 * separate runs was registered twice (typically by two modules) and fails
 * bootstrap. Limitation: two consecutive registrations of the same route with
 * nothing between them are indistinguishable from one call with two handlers.
 */
export function assertNoDuplicateRoutes(app: RouteTable): void {
  const runs = new Map<string, number>();
  let previous = '';
  for (const route of app.routes) {
    const key = `${route.method} ${route.path}`;
    if (route.method !== 'ALL' && key !== previous) runs.set(key, (runs.get(key) ?? 0) + 1);
    previous = key;
  }
  const duplicates = [...runs.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  if (duplicates.length > 0) {
    throw new FrameworkError('DUPLICATE_ROUTE', `Duplicate route registrations: ${duplicates.join(', ')}`);
  }
}
