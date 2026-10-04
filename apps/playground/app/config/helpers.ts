import { createConfigReader } from '@framework/support';
import type { AppConfig } from '../../config';

/**
 * Typed config reader: every dotted path autocompletes in the editor and the
 * return type is exact (`config('http.port')` is `number`). Import this
 * instead of the global helper inside application code.
 */
export const { get: config, getWithDefault: configOrDefault } = createConfigReader<AppConfig>();

export type { AppConfig };
