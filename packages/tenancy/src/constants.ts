/** Constants of `@framework/tenancy`: DI tokens. */
import { token } from '@framework/core';
import type { TenantStore } from './types';

export const TENANT_STORE = token<TenantStore>('tenancy.store');
