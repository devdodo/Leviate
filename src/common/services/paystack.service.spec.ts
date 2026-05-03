import { createHmac } from 'crypto';
import { PaystackService } from './paystack.service';

describe('PaystackService', () => {
  it('validates Paystack webhook signatures with HMAC SHA512', () => {
    const secret = 'sk_test_secret';
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success' }));
    const signature = createHmac('sha512', secret).update(rawBody).digest('hex');
    const service = new PaystackService({
      get: jest.fn().mockReturnValue(secret),
    } as any);

    expect(service.verifyWebhookSignature(signature, rawBody)).toBe(true);
    expect(service.verifyWebhookSignature('bad-signature', rawBody)).toBe(false);
  });
});
