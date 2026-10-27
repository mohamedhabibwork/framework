import { defineProvider, EXECUTION_CONTEXT } from '@framework/core';
import {
  AUDIT_READER,
  AuditReader,
  createConnection,
  DATA_CONTEXT,
  DATABASE,
  TRANSACTION_CONTEXT,
  TransactionContext,
} from '@framework/database';
import type { AppConfig } from '../../config';

/**
 * Pooled PostgreSQL connection (singleton, closed on shutdown) and per-scope
 * data access: a transaction context plus the execution context (actor,
 * correlation id) repositories use for auditing. The audit reader serves the
 * `/audit` endpoints.
 */
export const databaseProvider = defineProvider<AppConfig>({
  name: 'database',
  register({ container, config }) {
    container.singleton(
      DATABASE,
      () =>
        createConnection({
          url: config.database.url,
          maxConnections: config.database.maxConnections,
          applicationName: config.app.name,
        }),
      (connection) => connection.close(),
    );
    container.scoped(TRANSACTION_CONTEXT, (r) => new TransactionContext(r.resolve(DATABASE).db));
    container.scoped(DATA_CONTEXT, (r) => ({
      transactions: r.resolve(TRANSACTION_CONTEXT),
      execution: r.resolve(EXECUTION_CONTEXT),
    }));
    container.scoped(AUDIT_READER, (r) => new AuditReader(r.resolve(TRANSACTION_CONTEXT).executor));
  },
});
