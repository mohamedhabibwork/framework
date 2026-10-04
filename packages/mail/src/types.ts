/**
 * Every interface and type alias of `@framework/mail` in one place.
 * Runtime values (classes, tokens, functions, schemas) live in their modules.
 */

// -- Messages ------------------------------------------------------------------

/** Raw message accepted by `Mailer.send`; validated before a transport sees it. */
export interface MailMessageInput {
  readonly from: string;
  /** One address or a non-empty list; normalized to an array. */
  readonly to: string | readonly string[];
  readonly cc?: string | readonly string[];
  readonly bcc?: string | readonly string[];
  readonly replyTo?: string | readonly string[];
  readonly subject: string;
  /** At least one of `text`/`html` is required (enforced by the schema refine). */
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Partial message accumulated by the `MailComposer` builder (`subject` optional while composing). */
export interface MailComposerInput {
  readonly to: string | readonly string[];
  readonly from?: string;
  readonly cc?: string | readonly string[];
  readonly bcc?: string | readonly string[];
  readonly replyTo?: string | readonly string[];
  readonly subject?: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Validated, normalized message handed to transports (`to`/`cc`/`bcc`/`replyTo` are arrays). */
export interface MailMessage {
  readonly from: string;
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
  readonly replyTo: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** One transport-level delivery result. */
export interface SentMessage {
  /** Transport-specific delivery id (queue id, relay message id, …). */
  readonly id: string;
  /** Recipient addresses the transport accepted. */
  readonly accepted: readonly string[];
}

// -- Errors ----------------------------------------------------------------------

/** Per-field validation error (422-style); mirrors `@framework/http`'s `FieldError`. */
export interface MailFieldError {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

// -- Transport -------------------------------------------------------------------

/** Capability flags a transport declares about itself. */
export interface MailTransportCapabilities {
  /** The transport can carry an `html` body (otherwise send text-only messages). */
  readonly html: boolean;
  /** One `send` call accepts many messages. */
  readonly batch: boolean;
}

/**
 * Delivery boundary behind the `Mailer`: message construction is separate
 * from transport (spec §8). Transports receive already-validated messages.
 */
export interface MailTransport {
  readonly capabilities: MailTransportCapabilities;
  send(messages: readonly MailMessage[]): Promise<readonly SentMessage[]>;
}

/** Built-in drivers; `smtp` is deliberately absent until an SMTP dependency is chosen. */
export type MailTransportDriver = 'console' | 'memory';

// -- Configuration ----------------------------------------------------------------

/** Validated `mail` section of the application configuration. */
export interface MailConfig {
  /** Development transport: `console` logs redacted lines, `memory` records verbatim (tests). */
  readonly driver: MailTransportDriver;
  /** Default From address applied when a message does not set one. */
  readonly from: string;
}

/** Options for `createMailProvider` (see provider.ts). */
export interface MailProviderOptions {
  /** Concrete transport overriding the configured driver (DI overrides, custom drivers). */
  readonly transport?: MailTransport;
}

/** Options for the `Mailer` service. */
export interface MailerOptions {
  readonly from: string;
}

import type { MailComposer, Mailer } from './mailer';

/** The `Mailer` and `MailComposer` classes (see ./mailer) are both implementation and public contract. */
export type { MailComposer, Mailer };
