import type { ServiceProvider } from '@framework/core';
import { listenersProvider } from '../app/listeners/listeners.provider';
import { authProvider } from '../app/modules/auth';
import { productsProvider } from '../app/modules/products';
import { cacheProvider } from '../app/providers/cache.provider';
import { dataProvider } from '../app/providers/data.provider';
import { databaseProvider } from '../app/providers/database.provider';
import { eventsProvider } from '../app/providers/events.provider';
import { loggingProvider } from '../app/providers/logging.provider';
import { mailProvider } from '../app/providers/mail.provider';
import { notificationsProvider } from '../app/providers/notifications.provider';
import { storageProvider } from '../app/providers/storage.provider';
import type { AppConfig } from '../config';

/**
 * Explicit provider registration. Order is resolved from `dependsOn`, with
 * one exception: `cacheProvider` must stay above the `@framework:providers`
 * marker — `make:auth` appends the auth provider there, and it publishes the
 * cache's rate limiter during its own registration.
 */
export const providers: readonly ServiceProvider<AppConfig>[] = [
  cacheProvider,
  loggingProvider,
  storageProvider,
  databaseProvider,
  eventsProvider,
  listenersProvider,
  dataProvider,
  mailProvider,
  notificationsProvider,
  // @framework:providers
  authProvider,
  productsProvider,
];
