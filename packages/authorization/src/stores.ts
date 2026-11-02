import { FrameworkError } from '@framework/core';
import type { DatabaseConnection } from '@framework/database';
import { and, eq, inArray } from 'drizzle-orm';
import { authorizationRolePermissions, authorizationRoles, authorizationUserRoles } from './schema';
import type { EditableRoleStore, SyncResult } from './types';

type RoleMap = Readonly<Record<string, readonly string[]>>;

const ownValue = (map: RoleMap, key: string): readonly string[] =>
  Object.hasOwn(map, key) ? (map[key] as readonly string[]) : [];

/** Roles held in memory: the `config` and `memory` drivers. A role nobody defined grants nothing. */
export class MemoryRoleStore implements EditableRoleStore {
  #roles: RoleMap;
  #assignments: RoleMap;

  constructor(roles: RoleMap = {}, assignments: RoleMap = {}) {
    this.#roles = structuredClone(roles);
    this.#assignments = structuredClone(assignments);
  }

  async permissionsOfRoles(roles: readonly string[]): Promise<readonly string[]> {
    return [...new Set(roles.flatMap((role) => ownValue(this.#roles, role)))];
  }

  async permissionsFor(userId: string): Promise<readonly string[]> {
    return this.permissionsOfRoles(ownValue(this.#assignments, userId));
  }

  async rolesOf(userId: string): Promise<readonly string[]> {
    return ownValue(this.#assignments, userId);
  }

  async assign(userId: string, role: string): Promise<void> {
    if (!Object.hasOwn(this.#roles, role)) {
      throw new FrameworkError('AUTHORIZATION_ROLE_UNKNOWN', `There is no role named "${role}"`);
    }
    const held = ownValue(this.#assignments, userId);
    if (!held.includes(role)) this.#assignments = { ...this.#assignments, [userId]: [...held, role] };
  }

  async revoke(userId: string, role: string): Promise<boolean> {
    const held = ownValue(this.#assignments, userId);
    if (!held.includes(role)) return false;
    this.#assignments = { ...this.#assignments, [userId]: held.filter((name) => name !== role) };
    return true;
  }

  async syncRoles(roles: RoleMap): Promise<SyncResult> {
    let added = 0;
    let removed = 0;
    for (const [role, permissions] of Object.entries(roles)) {
      const current = ownValue(this.#roles, role);
      added += permissions.filter((permission) => !current.includes(permission)).length;
      removed += current.filter((permission) => !permissions.includes(permission)).length;
    }
    this.#roles = { ...this.#roles, ...structuredClone(roles) };
    return { roles: Object.keys(roles).length, added, removed };
  }
}

/** Roles in PostgreSQL: the `database` driver. */
export class PgRoleStore implements EditableRoleStore {
  constructor(private readonly connection: DatabaseConnection) {}

  async permissionsFor(userId: string): Promise<readonly string[]> {
    const rows = await this.connection.db
      .selectDistinct({ permission: authorizationRolePermissions.permission })
      .from(authorizationUserRoles)
      .innerJoin(authorizationRolePermissions, eq(authorizationRolePermissions.roleId, authorizationUserRoles.roleId))
      .where(eq(authorizationUserRoles.userId, userId));
    return rows.map(({ permission }) => permission);
  }

  async permissionsOfRoles(roles: readonly string[]): Promise<readonly string[]> {
    if (roles.length === 0) return [];
    const rows = await this.connection.db
      .selectDistinct({ permission: authorizationRolePermissions.permission })
      .from(authorizationRoles)
      .innerJoin(authorizationRolePermissions, eq(authorizationRolePermissions.roleId, authorizationRoles.id))
      .where(inArray(authorizationRoles.name, [...roles]));
    return rows.map(({ permission }) => permission);
  }

  async rolesOf(userId: string): Promise<readonly string[]> {
    const rows = await this.connection.db
      .select({ name: authorizationRoles.name })
      .from(authorizationUserRoles)
      .innerJoin(authorizationRoles, eq(authorizationRoles.id, authorizationUserRoles.roleId))
      .where(eq(authorizationUserRoles.userId, userId));
    return rows.map(({ name }) => name);
  }

  async #roleId(role: string): Promise<string | null> {
    const rows = await this.connection.db
      .select({ id: authorizationRoles.id })
      .from(authorizationRoles)
      .where(eq(authorizationRoles.name, role))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async assign(userId: string, role: string): Promise<void> {
    const roleId = await this.#roleId(role);
    if (!roleId) throw new FrameworkError('AUTHORIZATION_ROLE_UNKNOWN', `There is no role named "${role}"`);
    await this.connection.db.insert(authorizationUserRoles).values({ userId, roleId }).onConflictDoNothing();
  }

  async revoke(userId: string, role: string): Promise<boolean> {
    const roleId = await this.#roleId(role);
    if (!roleId) return false;
    const removed = await this.connection.db
      .delete(authorizationUserRoles)
      .where(and(eq(authorizationUserRoles.userId, userId), eq(authorizationUserRoles.roleId, roleId)))
      .returning({ roleId: authorizationUserRoles.roleId });
    return removed.length > 0;
  }

  /** In one transaction, so a request never sees a role half updated. */
  async syncRoles(roles: RoleMap): Promise<SyncResult> {
    return this.connection.db.transaction(async (tx) => {
      let added = 0;
      let removed = 0;
      for (const [name, permissions] of Object.entries(roles)) {
        await tx.insert(authorizationRoles).values({ name }).onConflictDoNothing();
        const [role] = await tx
          .select({ id: authorizationRoles.id })
          .from(authorizationRoles)
          .where(eq(authorizationRoles.name, name));
        const roleId = role?.id as string;
        const current = await tx
          .select({ permission: authorizationRolePermissions.permission })
          .from(authorizationRolePermissions)
          .where(eq(authorizationRolePermissions.roleId, roleId));
        const held = current.map(({ permission }) => permission);
        const toAdd = [...new Set(permissions)].filter((permission) => !held.includes(permission));
        const toRemove = held.filter((permission) => !permissions.includes(permission));
        if (toAdd.length > 0) {
          await tx
            .insert(authorizationRolePermissions)
            .values(toAdd.map((permission) => ({ roleId, permission })))
            .onConflictDoNothing();
        }
        if (toRemove.length > 0) {
          await tx
            .delete(authorizationRolePermissions)
            .where(
              and(
                eq(authorizationRolePermissions.roleId, roleId),
                inArray(authorizationRolePermissions.permission, toRemove),
              ),
            );
        }
        added += toAdd.length;
        removed += toRemove.length;
      }
      return { roles: Object.keys(roles).length, added, removed };
    });
  }
}
