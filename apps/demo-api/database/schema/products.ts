import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Canonical persistence shape for products. Validators and DTOs derive from this table. */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date().toISOString()),
});
