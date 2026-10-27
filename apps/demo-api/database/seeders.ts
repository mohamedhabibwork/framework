import { defineSeeder } from '@framework/database';

/**
 * Registered seeders, run in list order by `bun run cli -- db:seed [name]`.
 * Keep them idempotent (guard on existing rows or upsert) — re-running is a
 * routine operation. Factories (`defineFactory` from `@framework/database`)
 * share shapes with tests; define them next to the seeder that uses them.
 */
export const seeders = [
  defineSeeder({
    name: 'smoke',
    async run({ log }) {
      log('smoke: nothing to seed yet — replace or extend this seeder');
    },
  }),
  // @framework:seeders
];
