import { MailTransportError } from './errors';
import { parseMailMessage } from './message';
import type {
  MailComposerInput,
  MailerOptions,
  MailMessageInput,
  MailTransport,
  MailTransportCapabilities,
  SentMessage,
} from './types';

/**
 * Fluent builder returned by `Mailer.to(...)`; every method returns `this`,
 * so the chain reads like the message it produces:
 * `mailer.to(a).subject(s).text(t).send()`.
 */
export class MailComposer {
  #rest: Omit<MailComposerInput, 'to'> = {};

  constructor(
    private readonly sendMail: (message: MailComposerInput) => Promise<readonly SentMessage[]>,
    private readonly to: string | readonly string[],
  ) {}

  /** Overrides the configured default From address. */
  from(address: string): this {
    this.#rest = { ...this.#rest, from: address };
    return this;
  }

  cc(address: string | readonly string[]): this {
    this.#rest = { ...this.#rest, cc: address };
    return this;
  }

  bcc(address: string | readonly string[]): this {
    this.#rest = { ...this.#rest, bcc: address };
    return this;
  }

  replyTo(address: string | readonly string[]): this {
    this.#rest = { ...this.#rest, replyTo: address };
    return this;
  }

  subject(subject: string): this {
    this.#rest = { ...this.#rest, subject };
    return this;
  }

  text(body: string): this {
    this.#rest = { ...this.#rest, text: body };
    return this;
  }

  html(body: string): this {
    this.#rest = { ...this.#rest, html: body };
    return this;
  }

  headers(headers: Readonly<Record<string, string>>): this {
    this.#rest = { ...this.#rest, headers };
    return this;
  }

  /** Validates the composed message and hands it to the transport. */
  send(): Promise<readonly SentMessage[]> {
    return this.sendMail({ to: this.to, ...this.#rest });
  }
}

/**
 * The mail service: builds messages (fluent or direct) and delivers them
 * through one transport. It applies the configured default From, validates
 * every message before the transport sees it, and wraps transport failures
 * as `MAIL_TRANSPORT_FAILED` with the cause preserved. Queue hand-off is an
 * integration point with `@framework/queue` and deliberately out of scope.
 */
export class Mailer {
  constructor(
    private readonly transport: MailTransport,
    private readonly options: MailerOptions,
  ) {}

  /** Capability flags of the bound transport, surfaced for callers. */
  get capabilities(): MailTransportCapabilities {
    return this.transport.capabilities;
  }

  /** Starts a fluent message: `mailer.to(a).subject(s).text(t).send()`. */
  to(to: string | readonly string[]): MailComposer {
    return new MailComposer((message) => this.deliver(message), to);
  }

  /** Sends a message directly; validation still runs before the transport. */
  send(message: MailMessageInput): Promise<readonly SentMessage[]> {
    return this.deliver(message);
  }

  /** Shared pipeline: apply the default From, validate, deliver, wrap failures. */
  async deliver(message: MailComposerInput): Promise<readonly SentMessage[]> {
    const parsed = parseMailMessage({ from: this.options.from, ...message });
    try {
      return await this.transport.send([parsed]);
    } catch (cause) {
      throw new MailTransportError('The mail transport failed to deliver the message', { cause });
    }
  }
}
