import { createConnection, defineSeeder } from '@framework/database';
import { count } from 'drizzle-orm';
import { loadAppConfig } from '../config';
import { products } from './schema/products';

/**
 * Registered seeders, run in list order by `bun run cli -- db:seed [name]`.
 * Seeders own their connections (the CLI never boots the container) and stay
 * idempotent, so re-running is always safe.
 */
export const seeders = [
  defineSeeder({
    name: 'products',
    async run({ log }) {
      const config = await loadAppConfig();
      const connection = createConnection({
        url: config.database.url,
        maxConnections: 1,
        applicationName: `${config.app.name}-seed`,
      });
      try {
        const existing = await connection.db.select({ total: count() }).from(products);
        if ((existing[0]?.total ?? 0) > 0) {
          log(`products: skipped (table already holds ${existing[0]?.total} row(s))`);
          return;
        }
        const inserted = await connection.db
          .insert(products)
          .values([
            { name: 'Sample widget', price: '19.99' },
            { name: 'Sample gadget', price: '49.50' },
          ])
          .returning({ id: products.id });
        log(`products: inserted ${inserted.length} row(s)`);
      } finally {
        await connection.close();
      }
    },
  }),
  // @framework:seeders
];
