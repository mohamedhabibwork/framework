/**
 * Compiled by its own `tsc` program (see `authorization.test.ts`): augmenting
 * `Register` is global to a program, so it cannot live in the monorepo's.
 */
import { GATE, type Gate, type Permission, requirePermission } from '@framework/authorization';
import { Container } from '@framework/core';
import type { PrincipalLike } from '@framework/http';

declare module '@framework/core' {
  interface Register {
    permissions: 'posts.publish' | 'users.manage';
  }
}

const gate: Gate = new Container().resolve(GATE);
const principal: PrincipalLike = { id: 'u', abilities: ['*'] };

export const ok: Promise<boolean> = gate.can(principal, 'posts.publish');
export const middleware = requirePermission('users.manage');
export const known: Permission = 'users.manage';

// @ts-expect-error not a registered permission
gate.can(principal, 'posts.publsh');
// @ts-expect-error not a registered permission
requirePermission('nope');
// @ts-expect-error not a registered permission
export const unknown: Permission = 'nope';
