// Public API of @framework/mail.
// Convention: every interface/type lives in `./types`, every constant in
// `./constants`; runtime values (classes, functions, schemas) stay in their modules.
export { mailConfigSchema } from './config-schema';
export { ConsoleMailTransport } from './console-transport';
export { MAIL_TRANSPORT, MAILER, SMTP_PLANNED } from './constants';
export { MailTransportError, MailValidationError } from './errors';
export { MailComposer, Mailer } from './mailer';
export { MemoryMailTransport } from './memory-transport';
export { mailAddressSchema, mailMessageSchema, mailRecipients, parseMailMessage, toMailFieldErrors } from './message';
export { createMailProvider } from './provider';
// Grouped conventions: every type in ./types, every constant in ./constants.
// (`MailComposer`/`Mailer` are class values exported from ./mailer above.)
export type {
  MailComposerInput,
  MailConfig,
  MailerOptions,
  MailFieldError,
  MailMessage,
  MailMessageInput,
  MailProviderOptions,
  MailTransport,
  MailTransportCapabilities,
  MailTransportDriver,
  SentMessage,
} from './types';
