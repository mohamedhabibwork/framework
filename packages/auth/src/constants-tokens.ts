import { token } from '@framework/core';
import type { ApiTokenStore, AuthService, PasswordHasher, SessionStore, UserProvider } from './types';

export const PASSWORD_HASHER = token<PasswordHasher>('auth.password-hasher');
export const USER_PROVIDER = token<UserProvider>('auth.user-provider');
export const SESSION_STORE = token<SessionStore>('auth.session-store');
export const TOKEN_STORE = token<ApiTokenStore>('auth.token-store');
export const AUTH_SERVICE = token<AuthService>('auth.service');
