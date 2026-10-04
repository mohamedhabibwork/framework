import { defineProvider, type ServiceProvider } from '@framework/core';
import { ConsoleMailTransport } from './console-transport';
import { MAIL_TRANSPORT, MAILER } from './constants';
import { Mailer } from './mailer';
import { MemoryMailTransport } from './memory-transport';
import type { MailConfig, MailProviderOptions, MailTransport } from './types';

export { MAIL_TRANSPORT, MAILER };

/**
 * Registers the mail stack as singletons: the configured transport
 * (`console` writes redacted JSON lines, `memory` records verbatim for
 * tests) and the `Mailer` bound to it. Applications add it to their
 * provider list; queue hand-off is an integration point with
 * `@framework/queue` (out of scope here).
 */
export function createMailProvider<TConfig extends { readonly mail: MailConfig }>(
  options: MailProviderOptions = {},
): ServiceProvider<TConfig> {
  return defineProvider<TConfig>({
    name: 'mail',
    register({ container, config }) {
      const mail = config.mail;
      container.singleton(MAIL_TRANSPORT, () => options.transport ?? transportFor(mail));
      container.singleton(MAILER, (r) => new Mailer(r.resolve(MAIL_TRANSPORT), { from: mail.from }));
    },
  });
}

function transportFor(mail: MailConfig): MailTransport {
  if (mail.driver === 'memory') return new MemoryMailTransport();
  return new ConsoleMailTransport();
}
