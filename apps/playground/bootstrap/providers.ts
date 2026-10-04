import type { ServiceProvider } from '@framework/core';
import { workflowProvider } from '@framework/workflow';
import { productsProvider } from '../app/modules/products';
import { authProvider } from '../app/providers/auth.provider';
import { dataProvider } from '../app/providers/data.provider';
import { databaseProvider } from '../app/providers/database.provider';
import { eventsProvider } from '../app/providers/events.provider';
import { workflowsProvider } from '../app/workflows';
import type { AppConfig } from '../config';

/** Explicit provider registration. Order is resolved from `dependsOn`. */
export const providers: readonly ServiceProvider<AppConfig>[] = [
  databaseProvider,
  eventsProvider,
  authProvider,
  dataProvider,
  // @framework:providers
  productsProvider,
  workflowProvider,
  workflowsProvider,
];
