import { Application } from '@framework/core';
import type { AppConfig } from '../config';
import { providers } from './providers';

export type DemoApiTestApplication = Application<AppConfig>;

/** Builds the framework application. Callers boot it and own its shutdown. */
export function createApplication(config: AppConfig): DemoApiTestApplication {
  return new Application<AppConfig>({ config, providers });
}
