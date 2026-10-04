import { mailRecipients } from './message';
import type { MailMessage, MailTransport, MailTransportCapabilities, SentMessage } from './types';

/**
 * The documented test/fake transport (the mail counterpart of crud's
 * `LocalExportStore`): records every message verbatim in memory so tests
 * assert on exactly what the `Mailer` produced. `failNext` simulates a
 * delivery failure once to exercise caller error handling. A fake records
 * intended delivery only — it is not evidence of real infrastructure
 * behavior (spec §9); real-transport integration tests prove that.
 */
export class MemoryMailTransport implements MailTransport {
  readonly capabilities: MailTransportCapabilities = { html: true, batch: true };

  #sent: MailMessage[] = [];
  #failure: Error | undefined;

  constructor(private readonly newId: () => string = () => crypto.randomUUID()) {}

  /** Arms a one-shot failure: the next `send` throws it and consumes it. */
  failNext(error: Error): void {
    this.#failure = error;
  }

  /** Every delivered message, oldest first, recorded verbatim. */
  sent(): readonly MailMessage[] {
    return this.#sent;
  }

  clear(): void {
    this.#sent = [];
  }

  async send(messages: readonly MailMessage[]): Promise<readonly SentMessage[]> {
    if (this.#failure) {
      const failure = this.#failure;
      this.#failure = undefined;
      throw failure;
    }
    this.#sent.push(...messages);
    return messages.map((message) => ({ id: this.newId(), accepted: mailRecipients(message) }));
  }
}
