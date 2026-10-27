import { createStorageProvider } from '@framework/storage';
import type { AppConfig } from '../../config';

/**
 * Storage disks from the `storage` section: every `storage.disks` entry
 * becomes a singleton under `storageDiskToken(name)` and the
 * `storage.default` disk is bound to `STORAGE`. The generated default is
 * one private local disk rooted inside the app (gitignored); add cloud
 * drivers as new entries with their kit `options`.
 */
export const storageProvider = createStorageProvider<AppConfig>();
