import { resolveCorsOrigins } from './cors-origins.util';

describe('resolveCorsOrigins', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.CORS_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('returns true when no origins configured', () => {
    expect(resolveCorsOrigins()).toBe(true);
  });

  it('merges CORS_ORIGINS, FRONTEND_URL, and APP_URL', () => {
    process.env.CORS_ORIGINS = 'https://leviateapp.com, https://foo.com';
    process.env.FRONTEND_URL = 'https://leviateapp.com';
    process.env.APP_URL = 'https://backend.leviateapp.com';

    expect(resolveCorsOrigins()).toEqual([
      'https://leviateapp.com',
      'https://foo.com',
      'https://backend.leviateapp.com',
    ]);
  });
});
