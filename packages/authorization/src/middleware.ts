import {
  currentPrincipal,
  type FrameworkEnv,
  forbidden,
  type ResourceAbility,
  type ResourcePolicy,
  resolve,
  unauthenticated,
} from '@framework/http';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { GATE } from './constants';
import type { Ability, Permission } from './types';

/** 401 for an anonymous request, 403 for a principal without the permission. */
export const requirePermission = (permission: Permission) =>
  createMiddleware<FrameworkEnv>(async (c, next) => {
    const principal = currentPrincipal(c);
    if (!principal) throw unauthenticated();
    if (!(await resolve(c, GATE).can(principal, permission))) throw forbidden();
    await next();
  });

/**
 * Checks an ability, loading what it's about from the request. A missing subject is
 * denied without running the check, because one written null-safely could pass it.
 */
export const authorizeAbility = <TSubject>(
  ability: Ability<TSubject>,
  subjectOf: (c: Context<FrameworkEnv>) => TSubject | Promise<TSubject>,
) =>
  createMiddleware<FrameworkEnv>(async (c, next) => {
    const principal = currentPrincipal(c);
    if (!principal) throw unauthenticated();
    const subject = await subjectOf(c);
    if (subject === null || subject === undefined) throw forbidden();
    if (!(await resolve(c, GATE).can(principal, ability, subject))) throw forbidden();
    await next();
  });

const RESOURCE_ABILITIES: readonly ResourceAbility[] = [
  'viewAny',
  'view',
  'create',
  'audit',
  'update',
  'delete',
  'restore',
  '*',
  'export',
  'import',
  'bulkDelete',
  'bulkCreate',
];

/**
 * A policy for `defineResource({ access })` and generated modules: each ability
 * needs the permission `<prefix>.<ability>`.
 */
export const permissionPolicy = (prefix: string): ResourcePolicy =>
  Object.fromEntries(
    RESOURCE_ABILITIES.map((ability) => [
      ability,
      (c: Context<FrameworkEnv>) => resolve(c, GATE).can(currentPrincipal(c), `${prefix}.${ability}` as Permission),
    ]),
  ) as ResourcePolicy;
