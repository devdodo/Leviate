import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService over SMTP', () => {
  const env: Record<string, string> = {
    SMTP_HOST: 'mail.leviateapp.test',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'accounts@leviateapp.test',
    SMTP_PASSWORD: 'secret',
    FROM_NAME: 'Leviate',
    FROM_EMAIL: 'accounts@leviateapp.test',
  };

  let sendMail: jest.Mock;
  let verify: jest.Mock;
  let close: jest.Mock;

  function build(overrides: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((key: string) => {
        const merged = { ...env, ...overrides };
        return merged[key];
      }),
    };
    return new EmailService(config as any);
  }

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: '<abc@test>', rejected: [] });
    verify = jest.fn().mockResolvedValue(true);
    close = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      verify,
      close,
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('builds a pooled transport from the SMTP settings', () => {
    build();

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'mail.leviateapp.test',
        port: 465,
        secure: true,
        auth: { user: 'accounts@leviateapp.test', pass: 'secret' },
        pool: true,
      }),
    );
  });

  it('treats SMTP_SECURE=false as STARTTLS', () => {
    build({ SMTP_SECURE: 'false', SMTP_PORT: '587' });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it('falls back to the authenticated mailbox when FROM_EMAIL is unset', async () => {
    const service = build({ FROM_EMAIL: undefined });

    await service.sendOTP('user@example.com', '123456', 'Ada');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Leviate <accounts@leviateapp.test>' }),
    );
  });

  it('sends a single message through the transport', async () => {
    const service = build();

    await service.sendOTP('user@example.com', '123456', 'Ada');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const payload = sendMail.mock.calls[0][0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toContain('Verify');
    expect(payload.html).toContain('123456');
  });

  it('does not send, or throw, when SMTP is unconfigured', async () => {
    const service = build({ SMTP_HOST: undefined, SMTP_USER: undefined });

    await expect(service.sendOTP('user@example.com', '123456')).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('swallows a send failure so callers are never broken by mail', async () => {
    sendMail.mockRejectedValue(new Error('connection refused'));
    const service = build();

    await expect(service.sendOTP('user@example.com', '123456')).resolves.toBeUndefined();
  });

  describe('broadcast', () => {
    const details = { campaignTitle: 'Summer push', taskUrl: 'https://app.test/tasks/1' };

    it('sends one personally addressed message per recipient', async () => {
      const service = build();

      const result = await service.sendNewTaskAvailable(
        [
          { email: 'a@example.com', firstName: 'Ada' },
          { email: 'b@example.com', firstName: null },
        ],
        details,
      );

      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(sendMail).toHaveBeenCalledTimes(2);
      // Each message goes to exactly one recipient — no shared To/BCC.
      expect(sendMail.mock.calls.map((c) => c[0].to)).toEqual([
        'a@example.com',
        'b@example.com',
      ]);
      expect(sendMail.mock.calls[0][0].html).toContain('Ada');
    });

    it('keeps going when one recipient fails, and counts it', async () => {
      sendMail
        .mockResolvedValueOnce({ messageId: '<1>', rejected: [] })
        .mockRejectedValueOnce(new Error('mailbox full'))
        .mockResolvedValueOnce({ messageId: '<3>', rejected: [] });
      const service = build();

      const result = await service.sendNewTaskAvailable(
        [
          { email: 'a@example.com' },
          { email: 'b@example.com' },
          { email: 'c@example.com' },
        ],
        details,
      );

      expect(result).toEqual({ sent: 2, failed: 1 });
      expect(sendMail).toHaveBeenCalledTimes(3);
    });

    it('counts a recipient the host rejected as failed', async () => {
      sendMail.mockResolvedValue({ messageId: '<1>', rejected: ['a@example.com'] });
      const service = build();

      const result = await service.sendNewTaskAvailable([{ email: 'a@example.com' }], details);

      expect(result).toEqual({ sent: 0, failed: 1 });
    });

    it('never runs more sends at once than SMTP_MAX_CONNECTIONS', async () => {
      let inFlight = 0;
      let peak = 0;
      sendMail.mockImplementation(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return { messageId: '<x>', rejected: [] };
      });
      const service = build({ SMTP_MAX_CONNECTIONS: '2' });

      const recipients = Array.from({ length: 10 }, (_, i) => ({
        email: `u${i}@example.com`,
      }));
      const result = await service.sendNewTaskAvailable(recipients, details);

      expect(result.sent).toBe(10);
      expect(peak).toBeLessThanOrEqual(2);
    });

    it('reports nothing sent when email is disabled', async () => {
      const service = build({ NOTIFICATION_EMAIL_ENABLED: 'false' });

      const result = await service.sendNewTaskAvailable([{ email: 'a@example.com' }], details);

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  it('closes pooled connections on shutdown', () => {
    const service = build();

    service.onModuleDestroy();

    expect(close).toHaveBeenCalled();
  });
});
