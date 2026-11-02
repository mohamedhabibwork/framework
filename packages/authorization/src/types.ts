/**
 * Every interface and type of `@framework/authorization`. Type-only: importing
 * from this module never emits runtime code.
 */
import type { Register } from '@framework/core';
import type { PrincipalLike } from '@framework/http';

/** The names in `Register.permissions`, or any string when it isn't declared. */
export type Permission = Register extends { readonly permissions: infer TPermission extends string }
  ? TPermission
  : string;

/** What an ability's check receives. */
export interface AbilityContext<TSubject, TActor extends PrincipalLike> {
  readonly actor: TActor;
  readonly subject: TSubject;
  /** Whether this actor holds a permission, by role and within any token's scopes. */
  can(permission: Permission): Promise<boolean>;
}

/** A rule about a specific thing, such as "may edit this post". Build one with `defineAbility`. */
export interface Ability<TSubject = void, TActor extends PrincipalLike = PrincipalLike> {
  readonly name: string;
  check(context: AbilityContext<TSubject, TActor>): boolean | Promise<boolean>;
}

/** Decides what a principal may do. Everything is denied unless something grants it. */
export interface Gate {
  /** Whether `actor` holds a permission, or passes an ability's check. A missing actor never does. */
  can(actor: PrincipalLike | null | undefined, permission: Permission): Promise<boolean>;
  can<TActor extends PrincipalLike>(actor: TActor | null | undefined, ability: Ability<void, TActor>): Promise<boolean>;
  can<TSubject, TActor extends PrincipalLike>(
    actor: TActor | null | undefined,
    ability: Ability<TSubject, TActor>,
    subject: TSubject,
  ): Promise<boolean>;
  /** As `can`, but throws: 401 for a missing actor, 403 for one who may not. */
  authorize(actor: PrincipalLike | null | undefined, permission: Permission): Promise<void>;
  authorize<TActor extends PrincipalLike>(
    actor: TActor | null | undefined,
    ability: Ability<void, TActor>,
  ): Promise<void>;
  authorize<TSubject, TActor extends PrincipalLike>(
    actor: TActor | null | undefined,
    ability: Ability<TSubject, TActor>,
    subject: TSubject,
  ): Promise<void>;
}

/** Where a user's roles and each role's permissions come from. */
export interface RoleStore {
  /** Permissions granted by this user's roles; `*` grants them all. */
  permissionsFor(userId: string): Promise<readonly string[]>;
  /** Permissions granted by these roles, for roles that come from the principal. */
  permissionsOfRoles(roles: readonly string[]): Promise<readonly string[]>;
}

/** A role store that can also be changed. */
export interface EditableRoleStore extends RoleStore {
  assign(userId: string, role: string): Promise<void>;
  revoke(userId: string, role: string): Promise<boolean>;
  rolesOf(userId: string): Promise<readonly string[]>;
  /**
   * Makes each listed role hold exactly these permissions, creating it if needed.
   * Assignments are kept, and roles not listed are left alone.
   */
  syncRoles(roles: Readonly<Record<string, readonly string[]>>): Promise<SyncResult>;
}

/** What `syncRoles` changed. */
export interface SyncResult {
  readonly roles: number;
  readonly added: number;
  readonly removed: number;
}

/** Validated `authorization` config section. */
export interface AuthorizationConfig {
  /** `config` reads `roles` and `assignments` below, `memory` also lets them change, `database` uses its tables. */
  readonly driver: 'config' | 'memory' | 'database';
  /** Each role's permissions. `*` grants them all. */
  readonly roles: Readonly<Record<string, readonly string[]>>;
  /** Each user id's roles, for the `config` and `memory` drivers. */
  readonly assignments: Readonly<Record<string, readonly string[]>>;
}
