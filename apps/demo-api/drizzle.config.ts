import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` diffs the schema offline; no database connection is needed.
// Migrations are applied by `bun run cli -- db:migrate` (locked, explicit release step).
export default defineConfig({
  dialect: 'postgresql',
  schema: './database/schema/index.ts',
  out: './database/migrations',
  strict: true,
  verbose: true,
});
