import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ImageKitService } from './imagekit.service';

function buildService(env: Record<string, string | undefined>): ImageKitService {
  return new ImageKitService({
    get: (key: string) => env[key],
  } as any);
}

const CONFIGURED = {
  IMAGEKIT_PRIVATE_KEY: 'private_abc123',
  IMAGEKIT_UPLOAD_FOLDER: 'elevare',
};

const SUCCESS_BODY = {
  fileId: 'file-1',
  name: 'photo_abc.jpg',
  url: 'https://ik.imagekit.io/demo/elevare/user-1/photo_abc.jpg',
  thumbnailUrl: 'https://ik.imagekit.io/demo/tr:n-ik_ml_thumbnail/photo_abc.jpg',
  filePath: '/elevare/user-1/photo_abc.jpg',
  fileType: 'image',
  size: 2048,
  width: 800,
  height: 600,
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

const file = {
  buffer: Buffer.from('binary-content'),
  originalname: 'my photo.JPG',
  mimetype: 'image/jpeg',
};

describe('ImageKitService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('authenticates with base64("<private key>:")', async () => {
    const fetchMock = mockFetch(200, SUCCESS_BODY);

    await buildService(CONFIGURED).uploadFile(file, { folder: 'user-1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://upload.imagekit.io/api/v1/files/upload');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('private_abc123:').toString('base64')}`,
    );
  });

  it('strips a trailing colon or Basic prefix pasted with the key', async () => {
    const fetchMock = mockFetch(200, SUCCESS_BODY);

    await buildService({
      ...CONFIGURED,
      IMAGEKIT_PRIVATE_KEY: '"Basic private_abc123:"',
    }).uploadFile(file);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from('private_abc123:').toString('base64')}`,
    );
  });

  it('sends a sanitized file name, the scoped folder, and unique naming', async () => {
    const fetchMock = mockFetch(200, SUCCESS_BODY);

    await buildService(CONFIGURED).uploadFile(file, {
      folder: 'user-1/submissions',
      tags: ['user:user-1'],
    });

    const form: FormData = fetchMock.mock.calls[0][1].body;
    expect(form.get('fileName')).toBe('my_photo.JPG');
    expect(form.get('folder')).toBe('/elevare/user-1/submissions');
    expect(form.get('useUniqueFileName')).toBe('true');
    expect(form.get('tags')).toBe('user:user-1');
  });

  it('normalizes the upload result', async () => {
    mockFetch(200, SUCCESS_BODY);

    const result = await buildService(CONFIGURED).uploadFile(file);

    expect(result).toEqual({
      fileId: 'file-1',
      name: 'photo_abc.jpg',
      url: SUCCESS_BODY.url,
      thumbnailUrl: SUCCESS_BODY.thumbnailUrl,
      filePath: '/elevare/user-1/photo_abc.jpg',
      fileType: 'image',
      size: 2048,
      width: 800,
      height: 600,
    });
  });

  it('nulls optional fields absent for non-image uploads', async () => {
    mockFetch(200, {
      fileId: 'file-2',
      name: 'doc.pdf',
      url: 'https://ik.imagekit.io/demo/doc.pdf',
      filePath: '/elevare/user-1/doc.pdf',
      fileType: 'non-image',
      size: 100,
    });

    const result = await buildService(CONFIGURED).uploadFile({
      buffer: Buffer.from('%PDF-'),
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
    });

    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
  });

  it('surfaces an ImageKit 400 message to the caller', async () => {
    mockFetch(400, { message: 'Your account cannot upload this file type' });

    await expect(buildService(CONFIGURED).uploadFile(file)).rejects.toThrow(
      new BadRequestException('Your account cannot upload this file type'),
    );
  });

  it('hides auth, rate-limit and server failures behind ServiceUnavailable', async () => {
    for (const status of [401, 403, 429, 500]) {
      mockFetch(status, { message: 'nope' });
      await expect(buildService(CONFIGURED).uploadFile(file)).rejects.toThrow(
        ServiceUnavailableException,
      );
    }
  });

  it('maps a network failure to ServiceUnavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT')) as any;

    await expect(buildService(CONFIGURED).uploadFile(file)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects a 200 response missing url or fileId', async () => {
    mockFetch(200, { name: 'photo.jpg' });

    await expect(buildService(CONFIGURED).uploadFile(file)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('fails closed without a private key, before any request', async () => {
    const fetchMock = mockFetch(200, SUCCESS_BODY);

    await expect(buildService({}).uploadFile(file)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty buffer', async () => {
    const fetchMock = mockFetch(200, SUCCESS_BODY);

    await expect(
      buildService(CONFIGURED).uploadFile({
        buffer: Buffer.alloc(0),
        originalname: 'empty.jpg',
        mimetype: 'image/jpeg',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('sanitizeFileName', () => {
    it.each([
      ['../../etc/passwd', 'passwd'],
      ['C:\\Users\\me\\report.pdf', 'report.pdf'],
      ['my photo (1).png', 'my_photo_1_.png'],
      ['   ', 'upload'],
      ['...', 'upload'],
    ])('sanitizes %s', (input, expected) => {
      expect(ImageKitService.sanitizeFileName(input)).toBe(expected);
    });

    it('truncates very long names', () => {
      expect(
        ImageKitService.sanitizeFileName(`${'a'.repeat(300)}.jpg`).length,
      ).toBe(120);
    });
  });

  describe('buildFolder', () => {
    it('scopes to the configured base folder', () => {
      const service = buildService(CONFIGURED);
      expect(service.buildFolder('user-1')).toBe('/elevare/user-1');
      expect(service.buildFolder('user-1/submissions')).toBe(
        '/elevare/user-1/submissions',
      );
      expect(service.buildFolder()).toBe('/elevare');
    });

    it('cannot be escaped with traversal segments', () => {
      const service = buildService(CONFIGURED);
      expect(service.buildFolder('../../other')).toBe('/elevare/other');
      expect(service.buildFolder('user-1/../../../etc')).toBe(
        '/elevare/user-1/etc',
      );
      expect(service.buildFolder('..')).toBe('/elevare');
    });
  });
});
