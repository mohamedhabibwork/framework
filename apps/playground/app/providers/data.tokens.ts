import { token } from '@framework/core';
import type { DataPorter, ExportStore } from '@framework/crud';

/** Shared export artifact store (local disk under storage/exports). */
export const EXPORT_STORE = token<ExportStore>('data.export-store');

/** Queued import/export dispatcher for the resources that opt in. */
export const DATA_PORTER = token<DataPorter>('data.porter');
