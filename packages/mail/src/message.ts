import { z } from 'zod/v4';
import { MailValidationError } from './errors';
import type { MailComposerInput, MailFieldError, MailMessage } from './types';

/** One recipient address: trimmed, lower-cased, simple email check (same rule as auth). */
export const mailAddressSchema = z.string().trim().toLowerCase().email();

function asList(value: string | readonly string[]): string[] {
  return typeof value === 'string' ? [value] : [...value];
}

/** One address or a non-empty list of them; always normalized to an array. */
const addressListSchema = z.union([mailAddressSchema, z.array(mailAddressSchema).min(1)]).transform(asList);

/** Same as `addressListSchema` but accepts an empty list too (normalized output stays valid). */
const optionalListSchema = z.union([mailAddressSchema, z.array(mailAddressSchema)]).transform(asList);

const messageObjectSchema = z.object({
  from: mailAddressSchema,
  to: addressListSchema,
  cc: optionalListSchema.optional(),
  bcc: optionalListSchema.optional(),
  replyTo: optionalListSchema.optional(),
  subject: z.string().trim().min(1, 'Subject is required').max(998, 'Subject exceeds the 998-character line limit'),
  text: z.string().optional(),
  html: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Validated message shape: every recipient list is normalized to an array,
 * `cc`/`bcc`/`replyTo` default to `[]`, and exactly one body rule applies —
 * `text`, `html`, or both.
 */
export const mailMessageSchema = messageObjectSchema
  .refine((message) => message.text !== undefined || message.html !== undefined, {
    error: 'Either a text or an html body is required',
    path: ['body'],
  })
  .transform(({ text, html, ...rest }) => ({
    ...rest,
    cc: rest.cc ?? [],
    bcc: rest.bcc ?? [],
    replyTo: rest.replyTo ?? [],
    ...(text !== undefined ? { text } : {}),
    ...(html !== undefined ? { html } : {}),
    headers: rest.headers ?? {},
  }));

/** Every address a message would reach (`to` + `cc` + `bcc`), as transports accept them. */
export function mailRecipients(message: MailMessage): string[] {
  return [...message.to, ...message.cc, ...message.bcc];
}

/** Maps zod issues to 422-style field errors (same projection as `@framework/validation`). */
export function toMailFieldErrors(error: { readonly issues: readonly z.core.$ZodIssue[] }): MailFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

/** Validates a raw message and returns the normalized `MailMessage`, or throws `MailValidationError`. */
export function parseMailMessage(input: MailComposerInput): MailMessage {
  const result = mailMessageSchema.safeParse(input);
  if (!result.success) throw new MailValidationError(toMailFieldErrors(result.error));
  return result.data;
}
