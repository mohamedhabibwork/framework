import {
  createTokenSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  totpCodeSchema,
  twoStepSchema,
  verifyEmailSchema,
} from '@framework/auth';
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
    summary:
      'Verify credentials and start a session; two-step accounts receive `{ twoStep: true, challenge }` instead (complete at /auth/two-step)',
    security: 'public',
    request: { body: loginSchema },
    responses: {
      200: {
        description: 'Logged in, or a two-step challenge',
        schema: z.object({ twoStep: z.boolean(), challenge: z.string().optional() }),
      },
    },
    errors: [401, 403, 422, 429],
  },
  {
    method: 'post',
    path: '/two-step',
    operationId: 'auth:two-step',
    summary: 'Complete a two-step login with a TOTP or recovery code',
    security: 'public',
    request: { body: twoStepSchema },
    responses: { 200: { description: 'Logged in', schema: sessionResponse } },
    errors: [401, 422],
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
    path: '/email/verification-request',
    operationId: 'auth:request-email-verification',
    summary: 'Send (or re-send) the email-verification token via the app notifier',
    security: tokenSecurity,
    responses: { 202: { description: 'Verification email dispatched' } },
    errors: [401, 403],
  },
  {
    method: 'post',
    path: '/email/verify',
    operationId: 'auth:verify-email',
    summary: 'Verify an email address with the single-use token',
    security: 'public',
    request: { body: verifyEmailSchema },
    responses: { 200: { description: 'Email verified', schema: sessionResponse } },
    errors: [422],
  },
  {
    method: 'post',
    path: '/password/forgot',
    operationId: 'auth:forgot-password',
    summary: 'Request a password-reset token (identical response for unknown emails)',
    security: 'public',
    request: { body: forgotPasswordSchema },
    responses: { 202: { description: 'Reset email dispatched when the account exists' } },
    errors: [422],
  },
  {
    method: 'post',
    path: '/password/reset',
    operationId: 'auth:reset-password',
    summary: 'Rotate the password with a reset token; revokes all sessions and API tokens',
    security: 'public',
    request: { body: resetPasswordSchema },
    responses: { 204: { description: 'Password rotated' } },
    errors: [422],
  },
  {
    method: 'post',
    path: '/totp/enroll',
    operationId: 'auth:totp-enroll',
    summary: 'Start TOTP enrollment (returns the secret and otpauth:// URI)',
    security: tokenSecurity,
    responses: {
      200: { description: 'Pending secret', schema: z.object({ secret: z.string(), uri: z.string() }) },
    },
    errors: [401],
  },
  {
    method: 'post',
    path: '/totp/enable',
    operationId: 'auth:totp-enable',
    summary: 'Activate two-step login; returns one-time recovery codes (shown once)',
    security: tokenSecurity,
    request: { body: totpCodeSchema },
    responses: {
      200: { description: 'Recovery codes', schema: z.object({ recoveryCodes: z.array(z.string()) }) },
    },
    errors: [401, 422],
  },
  {
    method: 'post',
    path: '/totp/disable',
    operationId: 'auth:totp-disable',
    summary: 'Disable two-step login after verifying a code',
    security: tokenSecurity,
    request: { body: totpCodeSchema },
    responses: { 204: { description: 'Two-step login disabled' } },
    errors: [401, 422],
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
