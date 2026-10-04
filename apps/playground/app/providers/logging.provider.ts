import { defineProvider } from '@framework/core';
import { createLoggingProvider } from '@framework/logging';
import type { AppConfig } from '../../config';

/** The shared structured logger (`LOGGER`) built from the `logging` section. */
export const loggingProvider = defineProvider<AppConfig>(
  createLoggingProvider<AppConfig>((config: AppConfig) => config.logging),
);
