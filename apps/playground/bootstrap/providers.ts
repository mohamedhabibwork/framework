import type { ServiceProvider } from '@framework/core';
import { workflowProvider } from '@framework/workflow';
import { productsProvider } from '../app/modules/products';
import { authProvider } from '../app/providers/auth.provider';
import { cacheProvider } from '../app/providers/cache.provider';
import { dataProvider } from '../app/providers/data.provider';
import { databaseProvider } from '../app/providers/database.provider';
import { eventsProvider } from '../app/providers/events.provider';
import { loggingProvider } from '../app/providers/logging.provider';
import { storageProvider } from '../app/providers/storage.provider';
import { workflowsProvider } from '../app/workflows';
import type { AppConfig } from '../config';

/** Explicit provider registration. Order is resolved from `dependsOn`. */
export const providers: readonly ServiceProvider<AppConfig>[] = [
  databaseProvider,
  eventsProvider,
  // Before authProvider: auth binds the login rate limiter from the cache
  // stack while registering (container.has(RATE_LIMITER)).
  cacheProvider,
  authProvider,
  dataProvider,
  storageProvider,
  loggingProvider,
  // @framework:providers
  productsProvider,
  workflowProvider,
  workflowsProvider,
];
