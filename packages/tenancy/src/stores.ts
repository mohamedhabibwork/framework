import type { DatabaseConnection } from '@framework/database';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import type { RegisteredTenant, TenantStore } from './types';

/** Tenants for `PgTenantStore`. Export it from your schema so Drizzle Kit generates its migration. */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export class PgTenantStore implements TenantStore {
  constructor(private readonly connection: DatabaseConnection) {}

  async findBySlug(slug: string): Promise<RegisteredTenant | null> {
    const rows = await this.connection.db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    return (rows[0] as RegisteredTenant | undefined) ?? null;
  }

  async list(): Promise<readonly RegisteredTenant[]> {
    return (await this.connection.db.select().from(tenants)) as RegisteredTenant[];
  }
}

export class MemoryTenantStore implements TenantStore {
  constructor(private readonly all: readonly RegisteredTenant[]) {}

  async findBySlug(slug: string): Promise<RegisteredTenant | null> {
    return this.all.find((tenant) => tenant.slug === slug) ?? null;
  }

  async list(): Promise<readonly RegisteredTenant[]> {
    return this.all;
  }
}
