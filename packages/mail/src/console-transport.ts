import { mailRecipients } from './message';
import type { MailMessage, MailTransport, MailTransportCapabilities, SentMessage } from './types';

const textEncoder = new TextEncoder();

/**
 * One JSON log entry for a sent message, in the support logger's shape.
 * Bodies are redacted to byte sizes: message bodies routinely carry secrets
 * (password resets, invoices) and must never reach logs — only subject,
 * recipients and body byte-lengths do.
 */
function mailLogEntry(message: MailMessage): Record<string, unknown> {
  return {
    time: new Date().toISOString(),
    level: 'info',
    scope: 'mail',
    message: 'mail.sent',
    data: {
      from: message.from,
      to: [...message.to],
      cc: [...message.cc],
      bcc: [...message.bcc],
      ...(message.replyTo.length > 0 ? { replyTo: [...message.replyTo] } : {}),
      subject: message.subject,
      ...(message.text !== undefined ? { textBytes: textEncoder.encode(message.text).length } : {}),
      ...(message.html !== undefined ? { htmlBytes: textEncoder.encode(message.html).length } : {}),
    },
  };
}

/**
 * Development transport (support-style JSON logging): writes one JSON line
 * per message. Messages are accepted, not delivered — the log line is the
 * delivery record. The write function is injectable for tests.
 */
export class ConsoleMailTransport implements MailTransport {
  readonly capabilities: MailTransportCapabilities = { html: true, batch: true };

  constructor(private readonly write: (line: string) => void = (line) => console.error(line)) {}

  async send(messages: readonly MailMessage[]): Promise<readonly SentMessage[]> {
    return messages.map((message) => {
      this.write(JSON.stringify(mailLogEntry(message)));
      return { id: crypto.randomUUID(), accepted: mailRecipients(message) };
    });
  }
}
