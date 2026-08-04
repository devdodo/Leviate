import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DojahService } from './dojah.service';

function buildService(env: Record<string, string | undefined>): DojahService {
  return new DojahService({
    get: (key: string) => env[key],
  } as any);
}

const LIVE_ENV = {
  DOJAH_BASE_URL: 'https://sandbox.dojah.io',
  DOJAH_APP_ID: 'app-id',
  DOJAH_SECRET_KEY: 'secret-key',
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: async () => body,
  });
  global.fetch = fetchMock as any;
  return fetchMock;
}

describe('DojahService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the raw secret key as Authorization, not a Bearer token', async () => {
    const fetchMock = mockFetch(200, {
      entity: { first_name: 'Ada', last_name: 'Obi' },
    });

    await buildService(LIVE_ENV).lookupNin('70123456789');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.dojah.io/api/v1/kyc/nin?nin=70123456789');
    expect(init.headers.Authorization).toBe('secret-key');
    expect(init.headers.AppId).toBe('app-id');
  });

  it('strips an accidental Bearer prefix and wrapping quotes from credentials', async () => {
    const fetchMock = mockFetch(200, {
      entity: { first_name: 'Ada', last_name: 'Obi' },
    });

    await buildService({
      ...LIVE_ENV,
      DOJAH_SECRET_KEY: '"Bearer secret-key"',
    }).lookupNin('70123456789');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('secret-key');
  });

  it('normalizes the NIMC entity and drops the photo', async () => {
    mockFetch(200, {
      entity: {
        first_name: 'Ada',
        last_name: 'Obi',
        middle_name: 'Chidi',
        gender: 'Female',
        date_of_birth: '1995-04-02',
        phone_number: '08012345678',
        photo: 'base64-should-not-survive',
      },
    });

    const identity = await buildService(LIVE_ENV).lookupNin('70123456789');

    expect(identity).toEqual({
      nin: '70123456789',
      firstName: 'Ada',
      lastName: 'Obi',
      middleName: 'Chidi',
      gender: 'Female',
      dateOfBirth: '1995-04-02',
      phoneNumber: '08012345678',
      mocked: false,
    });
    expect(JSON.stringify(identity)).not.toContain('base64-should-not-survive');
  });

  it('rejects a 200 response with no usable identity', async () => {
    mockFetch(200, { entity: {} });

    await expect(buildService(LIVE_ENV).lookupNin('70123456789')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('surfaces a 4xx lookup failure as a BadRequest the user can act on', async () => {
    mockFetch(400, { error: 'Record not found' });

    await expect(
      buildService(LIVE_ENV).lookupNin('70123456789'),
    ).rejects.toThrow(new BadRequestException('Record not found'));
  });

  it('maps auth and server failures to ServiceUnavailable, not user error', async () => {
    mockFetch(401, { error: 'Invalid credentials' });
    await expect(buildService(LIVE_ENV).lookupNin('70123456789')).rejects.toThrow(
      ServiceUnavailableException,
    );

    mockFetch(503, { error: 'upstream down' });
    await expect(buildService(LIVE_ENV).lookupNin('70123456789')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('maps a network failure to ServiceUnavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as any;

    await expect(buildService(LIVE_ENV).lookupNin('70123456789')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('fails closed when credentials are missing', async () => {
    const fetchMock = mockFetch(200, {});

    await expect(
      buildService({ DOJAH_BASE_URL: 'https://sandbox.dojah.io' }).lookupNin(
        '70123456789',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call Dojah in mock mode and flags the result as mocked', async () => {
    const fetchMock = mockFetch(200, {});

    const identity = await buildService({
      DOJAH_MOCK_VERIFICATION: 'true',
    }).lookupNin('70123456789');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(identity.mocked).toBe(true);
    expect(identity.nin).toBe('70123456789');
  });

  it('enforces name matching unless explicitly disabled', () => {
    expect(buildService(LIVE_ENV).isNameMatchEnforced()).toBe(true);
    expect(
      buildService({ ...LIVE_ENV, DOJAH_ENFORCE_NAME_MATCH: 'true' }).isNameMatchEnforced(),
    ).toBe(true);
    expect(
      buildService({ ...LIVE_ENV, DOJAH_ENFORCE_NAME_MATCH: 'false' }).isNameMatchEnforced(),
    ).toBe(false);
  });

  it('reports the environment from the base URL', () => {
    expect(buildService(LIVE_ENV).getEnvironment()).toBe('sandbox');
    expect(
      buildService({ ...LIVE_ENV, DOJAH_BASE_URL: 'https://api.dojah.io' }).getEnvironment(),
    ).toBe('live');
  });

  it('defaults to the sandbox base URL when none is configured', async () => {
    const fetchMock = mockFetch(200, {
      entity: { first_name: 'Ada', last_name: 'Obi' },
    });

    await buildService({
      DOJAH_APP_ID: 'app-id',
      DOJAH_SECRET_KEY: 'secret-key',
    }).lookupNin('70123456789');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://sandbox.dojah.io/api/v1/kyc/nin?nin=70123456789',
    );
  });
});
