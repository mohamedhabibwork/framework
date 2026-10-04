import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Canonical persistence shape for products. Validators and DTOs derive from
 * this table via Drizzle–Zod; nothing duplicates these field rules.
 * - price: numeric mode `string` so money never passes through floats.
 * - timestamps: mode `string` so JSON transport matches the select schema.
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date().toISOString()),
});
