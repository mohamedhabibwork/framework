import { createTokenSchema, loginSchema, registerSchema } from '@framework/auth';
import { defineOperations } from '@framework/openapi';
import { z } from 'zod/v4';

const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const apiTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  abilities: z.array(z.string()),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string(),
  createdAt: z.string(),
});

const sessionResponse = z.object({ user: publicUserSchema });
const principalResponse = z.object({ user: publicUserSchema, via: z.string(), abilities: z.array(z.string()) });
const tokenSecurity = ['sessionCookie', 'bearerAuth'] as const;

/**
 * Documents the framework auth endpoints mounted at `/api/v1/auth`. Session
 * authentication is a cookie (scheme `sessionCookie`); API clients use
 * Bearer tokens (scheme `bearerAuth`).
 */
export const authOperations = defineOperations('/api/v1/auth', 'Auth', [
  {
    method: 'post',
    path: '/register',
    operationId: 'auth:register',
    summary: 'Create an account and start a session',
    security: 'public',
    request: { body: registerSchema },
    responses: { 201: { description: 'Account created', schema: sessionResponse } },
    errors: [409, 422],
  },
  {
    method: 'post',
    path: '/login',
    operationId: 'auth:login',
    summary: 'Verify credentials and start a session (rotates any previous one)',
    security: 'public',
    request: { body: loginSchema },
    responses: { 200: { description: 'Logged in', schema: sessionResponse } },
    errors: [401, 403, 422],
  },
  {
    method: 'post',
    path: '/logout',
    operationId: 'auth:logout',
    summary: 'Revoke the current session or token',
    security: tokenSecurity,
    responses: { 204: { description: 'Logged out' } },
    errors: [401, 403],
  },
  {
    method: 'get',
    path: '/me',
    operationId: 'auth:me',
    summary: 'Return the authenticated principal',
    security: tokenSecurity,
    responses: { 200: { description: 'Current principal', schema: principalResponse } },
    errors: [401],
  },
  {
    method: 'post',
    path: '/tokens',
    operationId: 'auth:create-token',
    summary: 'Issue a personal API token (plaintext returned once)',
    security: tokenSecurity,
    request: { body: createTokenSchema },
    responses: {
      201: { description: 'Token issued', schema: z.object({ token: apiTokenSchema, value: z.string() }) },
    },
    errors: [401, 422],
  },
  {
    method: 'get',
    path: '/tokens',
    operationId: 'auth:list-tokens',
    summary: 'List the principal\u2019s active API tokens',
    security: tokenSecurity,
    responses: { 200: { description: 'Active tokens', schema: z.object({ tokens: z.array(apiTokenSchema) }) } },
    errors: [401],
  },
  {
    method: 'delete',
    path: '/tokens/:id',
    operationId: 'auth:revoke-token',
    summary: 'Revoke one of the principal\u2019s API tokens',
    security: tokenSecurity,
    responses: { 204: { description: 'Token revoked' } },
    errors: [401, 404],
  },
]);
