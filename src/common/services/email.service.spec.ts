import { Resend } from 'resend';
import { EmailService } from './email.service';

jest.mock('resend');

describe('EmailService over Resend', () => {
  const env: Record<string, string> = {
    RESEND_API_KEY: 're_test_key',
    FROM_NAME: 'Leviate',
    FROM_EMAIL: 'accounts@leviateapp.test',
  };

  let send: jest.Mock;
  let batchSend: jest.Mock;
  let domainsList: jest.Mock;

  function build(overrides: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((key: string) => {
        const merged = { ...env, ...overrides };
        return merged[key];
      }),
    };
    return new EmailService(config as any);
  }

  /** One accepted id per message in the chunk, which is what Resend returns. */
  const acceptAll = (payloads: unknown[]) => ({
    data: { data: payloads.map((_, i) => ({ id: `id-${i}` })) },
    error: null,
  });

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    batchSend = jest.fn().mockImplementation(async (payloads) => acceptAll(payloads));
    domainsList = jest.fn().mockResolvedValue({
      data: { data: [{ name: 'leviateapp.test', status: 'verified' }] },
      error: null,
    });
    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send },
      batch: { send: batchSend },
      domains: { list: domainsList },
    }));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('builds the client from RESEND_API_KEY', () => {
    build();

    expect(Resend).toHaveBeenCalledWith('re_test_key');
  });

  it('falls back to the Resend sandbox sender when FROM_EMAIL is unset', async () => {
    const service = build({ FROM_EMAIL: undefined });

    await service.sendOTP('user@example.com', '123456', 'Ada');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Leviate <onboarding@resend.dev>' }),
    );
  });

  it('sends a single message through the API', async () => {
    const service = build();

    await service.sendOTP('user@example.com', '123456', 'Ada');

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toEqual(['user@example.com']);
    expect(payload.subject).toContain('Verify');
    expect(payload.html).toContain('123456');
  });

  it('sets replyTo only when REPLY_TO_EMAIL is configured', async () => {
    await build().sendOTP('user@example.com', '123456');
    expect(send.mock.calls[0][0]).not.toHaveProperty('replyTo');

    send.mockClear();
    await build({ REPLY_TO_EMAIL: 'help@leviateapp.test' }).sendOTP(
      'user@example.com',
      '123456',
    );
    expect(send.mock.calls[0][0]).toMatchObject({ replyTo: 'help@leviateapp.test' });
  });

  it('does not send, or throw, when the API key is unconfigured', async () => {
    const service = build({ RESEND_API_KEY: undefined });

    await expect(service.sendOTP('user@example.com', '123456')).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('swallows a thrown send failure so callers are never broken by mail', async () => {
    send.mockRejectedValue(new Error('network down'));
    const service = build();

    await expect(service.sendOTP('user@example.com', '123456')).resolves.toBeUndefined();
  });

  it('swallows a send rejected via the error field rather than a throw', async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'domain not verified' },
    });
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
      expect(batchSend).toHaveBeenCalledTimes(1);
      const chunk = batchSend.mock.calls[0][0];
      // Each message goes to exactly one recipient — no shared To/BCC.
      expect(chunk.map((m: any) => m.to)).toEqual([
        ['a@example.com'],
        ['b@example.com'],
      ]);
      expect(chunk[0].html).toContain('Ada');
    });

    it('splits a broadcast into chunks of 100', async () => {
      const service = build();
      const recipients = Array.from({ length: 250 }, (_, i) => ({
        email: `u${i}@example.com`,
      }));

      const result = await service.sendNewTaskAvailable(recipients, details);

      expect(batchSend).toHaveBeenCalledTimes(3);
      expect(batchSend.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
      expect(result).toEqual({ sent: 250, failed: 0 });
    });

    it('keeps going when one chunk fails, and counts it', async () => {
      batchSend
        .mockImplementationOnce(async (p) => acceptAll(p))
        .mockResolvedValueOnce({
          data: null,
          error: { name: 'rate_limit_exceeded', message: 'too many requests' },
        })
        .mockImplementationOnce(async (p) => acceptAll(p));
      const service = build();
      const recipients = Array.from({ length: 250 }, (_, i) => ({
        email: `u${i}@example.com`,
      }));

      const result = await service.sendNewTaskAvailable(recipients, details);

      expect(result).toEqual({ sent: 150, failed: 100 });
      expect(batchSend).toHaveBeenCalledTimes(3);
    });

    it('counts messages the API silently dropped from a chunk as failed', async () => {
      batchSend.mockResolvedValue({ data: { data: [{ id: 'id-0' }] }, error: null });
      const service = build();

      const result = await service.sendNewTaskAvailable(
        [{ email: 'a@example.com' }, { email: 'b@example.com' }],
        details,
      );

      expect(result).toEqual({ sent: 1, failed: 1 });
    });

    it('survives a chunk that throws outright', async () => {
      batchSend.mockRejectedValue(new Error('socket hang up'));
      const service = build();

      const result = await service.sendNewTaskAvailable([{ email: 'a@example.com' }], details);

      expect(result).toEqual({ sent: 0, failed: 1 });
    });

    it('reports nothing sent when email is disabled', async () => {
      const service = build({ NOTIFICATION_EMAIL_ENABLED: 'false' });

      const result = await service.sendNewTaskAvailable([{ email: 'a@example.com' }], details);

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(batchSend).not.toHaveBeenCalled();
    });
  });
});
