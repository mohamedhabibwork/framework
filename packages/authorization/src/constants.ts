/** Constants of `@framework/authorization`: DI tokens. */
import { token } from '@framework/core';
import type { EditableRoleStore, Gate, RoleStore } from './types';

/** The gate. */
export const GATE = token<Gate>('authorization.gate');

/** Where roles and permissions come from. */
export const ROLE_STORE = token<RoleStore | EditableRoleStore>('authorization.role-store');
