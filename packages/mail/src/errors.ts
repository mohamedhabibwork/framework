import { FrameworkError } from '@framework/core';
import type { MailFieldError } from './types';

/**
 * MAIL_VALIDATION_FAILED — a message failed the mail schema before reaching a
 * transport. Carries 422-style field errors so callers can render each issue.
 */
export class MailValidationError extends FrameworkError {
  constructor(readonly fields: readonly MailFieldError[]) {
    super('MAIL_VALIDATION_FAILED', 'The mail message is invalid');
  }
}

/**
 * MAIL_TRANSPORT_FAILED — the transport rejected the delivery. The original
 * error is preserved as `cause` for logging and retry decisions.
 */
export class MailTransportError extends FrameworkError {
  constructor(message: string, options: ErrorOptions) {
    super('MAIL_TRANSPORT_FAILED', message, options);
  }
}
