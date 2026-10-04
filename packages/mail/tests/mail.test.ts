import { describe, expect, spyOn, test } from 'bun:test';
import { Container, FrameworkError } from '@framework/core';
import {
  ConsoleMailTransport,
  createMailProvider,
  MAIL_TRANSPORT,
  MAILER,
  Mailer,
  MailTransportError,
  MailValidationError,
  MemoryMailTransport,
  mailMessageSchema,
  parseMailMessage,
} from '../src';

const from = 'no-reply@example.com';

const textMessage = {
  from,
  to: 'ada@example.com',
  cc: ['grace@example.com'],
  subject: 'Welcome',
  text: 'Hello Ada',
  headers: { 'X-Trace': 'trace-1' },
};

const byteLength = (body: string) => new TextEncoder().encode(body).length;

describe('mail message schema', () => {
  test('rejects a message without any body with 422-style field errors', () => {
    expect(() => parseMailMessage({ from, to: 'ada@example.com', subject: 'No body' })).toThrow(MailValidationError);
    try {
      parseMailMessage({ from, to: 'ada@example.com', subject: 'No body' });
    } catch (error) {
      expect(error).toBeInstanceOf(FrameworkError);
      expect((error as MailValidationError).code).toBe('MAIL_VALIDATION_FAILED');
      expect((error as MailValidationError).fields).toEqual([
        { path: 'body', message: 'Either a text or an html body is required', code: 'custom' },
      ]);
    }
  });

  test('rejects malformed addresses', () => {
    try {
      parseMailMessage({ ...textMessage, to: 'definitely-not-an-email' });
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(MailValidationError);
      const fields = (error as MailValidationError).fields;
      expect(fields.some((field) => field.path === 'to')).toBe(true);
    }
  });

  test('rejects a missing subject', () => {
    expect(() => parseMailMessage({ from, to: 'ada@example.com', text: 'Hello' })).toThrow(MailValidationError);
  });

  test('accepts text and html together and normalizes recipients to arrays', () => {
    const message = parseMailMessage({
      from,
      to: 'ada@example.com',
      cc: 'grace@example.com',
      subject: ' Welcome  ',
      text: 'Hello',
      html: '<p>Hello</p>',
    });
    expect(message).toEqual({
      from,
      to: ['ada@example.com'],
      cc: ['grace@example.com'],
      bcc: [],
      replyTo: [],
      subject: 'Welcome',
      text: 'Hello',
      html: '<p>Hello</p>',
      headers: {},
    });
    expect(mailMessageSchema.safeParse({ ...message, bcc: [] }).success).toBe(true);
  });
});

describe('Mailer', () => {
  test('applies the default from and passes the builder chain through', async () => {
    const transport = new MemoryMailTransport();
    const mailer = new Mailer(transport, { from });

    const [sent] = await mailer.to('ada@example.com').cc(['grace@example.com']).subject('Hi').text('Hello').send();

    expect(transport.sent()).toHaveLength(1);
    expect(transport.sent()[0]).toMatchObject({
      from,
      to: ['ada@example.com'],
      cc: ['grace@example.com'],
      subject: 'Hi',
      text: 'Hello',
    });
    expect(sent?.id).not.toBe('');
    expect(sent?.accepted).toEqual(['ada@example.com', 'grace@example.com']);
  });

  test('direct send keeps an explicit from and supports html-only bodies', async () => {
    const transport = new MemoryMailTransport();
    const mailer = new Mailer(transport, { from });

    await mailer.send({ from: 'billing@example.com', to: 'ada@example.com', subject: 'Invoice', html: '<p>Paid</p>' });

    expect(transport.sent()).toEqual([
      {
        from: 'billing@example.com',
        to: ['ada@example.com'],
        cc: [],
        bcc: [],
        replyTo: [],
        subject: 'Invoice',
        html: '<p>Paid</p>',
        headers: {},
      },
    ]);
  });

  test('surfaces the transport capability flags', () => {
    expect(new Mailer(new MemoryMailTransport(), { from }).capabilities).toEqual({ html: true, batch: true });
    expect(new Mailer(new ConsoleMailTransport(), { from }).capabilities).toEqual({ html: true, batch: true });
  });

  test('wraps transport failures as MAIL_TRANSPORT_FAILED with the cause preserved', async () => {
    const transport = new MemoryMailTransport();
    const mailer = new Mailer(transport, { from });
    transport.failNext(new Error('relay down'));

    try {
      await mailer.to('ada@example.com').subject('Hi').text('Hello').send();
      throw new Error('expected send to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(MailTransportError);
      expect(error).toBeInstanceOf(FrameworkError);
      expect((error as MailTransportError).code).toBe('MAIL_TRANSPORT_FAILED');
      expect((error as MailTransportError).cause).toBeInstanceOf(Error);
      expect(((error as MailTransportError).cause as Error).message).toBe('relay down');
    }
    // The failed message never reached the transport's record.
    expect(transport.sent()).toHaveLength(0);
  });
});

describe('MemoryMailTransport', () => {
  test('records messages verbatim, supports clear(), and consumes failNext once', async () => {
    const transport = new MemoryMailTransport();
    const message = parseMailMessage(textMessage);
    await transport.send([message]);

    expect(transport.sent()).toEqual([message]);
    expect(transport.sent()[0]?.headers).toEqual({ 'X-Trace': 'trace-1' });

    transport.clear();
    expect(transport.sent()).toEqual([]);

    transport.failNext(new Error('quota exceeded'));
    expect(transport.send([message])).rejects.toThrow('quota exceeded');
    expect(transport.sent()).toHaveLength(0);
    // The failure is one-shot: the next send succeeds.
    await transport.send([message]);
    expect(transport.sent()).toEqual([message]);
  });
});

describe('ConsoleMailTransport', () => {
  const secretText = 'reset token: šекрет-✓-123';
  const secretHtml = '<p>reset token: šекрет-✓-123</p>';

  test('logs one JSON line per message with bodies redacted to byte sizes', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const transport = new ConsoleMailTransport();
      const [sent] = await transport.send([
        parseMailMessage({
          from,
          to: ['ada@example.com', 'grace@example.com'],
          subject: 'Reset your password',
          text: secretText,
          html: secretHtml,
        }),
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
      const line = spy.mock.calls[0]?.[0] as string;
      const entry = JSON.parse(line) as { message: string; data: Record<string, unknown> };

      expect(entry.message).toBe('mail.sent');
      expect(entry.data.subject).toBe('Reset your password');
      expect(entry.data.from).toBe(from);
      expect(entry.data.to).toEqual(['ada@example.com', 'grace@example.com']);
      expect(entry.data.textBytes).toBe(byteLength(secretText));
      expect(entry.data.htmlBytes).toBe(byteLength(secretHtml));
      expect(sent?.accepted).toEqual(['ada@example.com', 'grace@example.com']);

      // The bodies themselves never hit the output.
      expect(line).not.toContain('reset');
      expect(line).not.toContain(secretHtml);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('createMailProvider', () => {
  type TestConfig = { readonly mail: { readonly driver: 'memory' | 'console'; readonly from: string } };

  test('binds the configured transport and the mailer as singletons', () => {
    const container = new Container();
    const provider = createMailProvider<TestConfig>();
    provider.register({ container, config: { mail: { driver: 'memory', from } } });

    const mailer = container.resolve(MAILER);
    expect(container.resolve(MAIL_TRANSPORT)).toBeInstanceOf(MemoryMailTransport);
    expect(mailer).toBeInstanceOf(Mailer);
    expect(container.resolve(MAILER)).toBe(mailer);
  });

  test('selects the console transport for the console driver and honors transport overrides', () => {
    const container = new Container();
    const provider = createMailProvider<TestConfig>();
    provider.register({ container, config: { mail: { driver: 'console', from } } });
    expect(container.resolve(MAIL_TRANSPORT)).toBeInstanceOf(ConsoleMailTransport);

    const override = new Container();
    const memory = new MemoryMailTransport();
    createMailProvider<TestConfig>({ transport: memory }).register({
      container: override,
      config: { mail: { driver: 'console', from } },
    });
    expect(override.resolve(MAIL_TRANSPORT)).toBe(memory);
  });

  test('the resolved mailer delivers with the configured default from', async () => {
    const container = new Container();
    createMailProvider<TestConfig>().register({ container, config: { mail: { driver: 'memory', from } } });

    const mailer = container.resolve(MAILER);
    await mailer.to('ada@example.com').subject('Hi').text('Hello').send();
    expect((container.resolve(MAIL_TRANSPORT) as MemoryMailTransport).sent()[0]?.from).toBe(from);
  });
});
