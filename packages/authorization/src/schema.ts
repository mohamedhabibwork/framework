import { users } from '@framework/auth';
import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Roles for the `database` driver. Export all three tables so Drizzle Kit generates their migration. */
export const authorizationRoles = pgTable('authorization_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const authorizationRolePermissions = pgTable(
  'authorization_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => authorizationRoles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

export const authorizationUserRoles = pgTable(
  'authorization_user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => authorizationRoles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
