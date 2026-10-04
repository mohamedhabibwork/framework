/**
 * Constants of `@framework/mail`: dependency-injection tokens and the SMTP
 * planning note.
 */
import { token } from '@framework/core';
import type { Mailer, MailTransport } from './types';

export const MAILER = token<Mailer>('mail.mailer');
export const MAIL_TRANSPORT = token<MailTransport>('mail.transport');

/**
 * SMTP_PLANNED — the SMTP transport is deliberately not implemented. Spec §8
 * requires real-transport integration tests to prove provider behavior, so a
 * real SMTP dependency has to be chosen first; none is bundled. Drivers are
 * `console` | `memory` until then and `mailConfigSchema` rejects anything else.
 */
export const SMTP_PLANNED =
  'mail: the SMTP transport is not implemented — deferred until an SMTP dependency is chosen' as const;
