import { defineProvider } from '@framework/core';
import { createStorageProvider } from '@framework/storage';
import type { AppConfig } from '../../config';

/**
 * Storage disks from the `storage` section: the `storage.default` disk is
 * bound to `STORAGE`, every entry to `storageDiskToken(name)`. The single
 * `local` disk roots at `<playground>/storage` (created on first use).
 */
export const storageProvider = defineProvider<AppConfig>(createStorageProvider<AppConfig>());
