// Public API of @framework/authorization.
// Convention: every interface/type lives in `./types`, every constant in
// `./constants`; runtime values (gate, stores, middleware, provider) stay in their modules.
export { GATE, ROLE_STORE } from './constants';
export { defineAbility, type GateOptions, RoleGate } from './gate';
export { authorizeAbility, permissionPolicy, requirePermission } from './middleware';
export { type AuthorizationProviderOptions, authorizationConfigSchema, createAuthorizationProvider } from './provider';
export { authorizationRolePermissions, authorizationRoles, authorizationUserRoles } from './schema';
export { MemoryRoleStore, PgRoleStore } from './stores';
export type {
  Ability,
  AbilityContext,
  AuthorizationConfig,
  EditableRoleStore,
  Gate,
  Permission,
  RoleStore,
  SyncResult,
} from './types';
