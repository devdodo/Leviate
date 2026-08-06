import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Subset of the ImageKit V1 upload response we surface to callers. */
export interface ImageKitUploadResult {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  filePath: string;
  fileType: string;
  size: number | null;
  width: number | null;
  height: number | null;
}

interface ImageKitUploadResponse {
  fileId?: string;
  name?: string;
  url?: string;
  thumbnailUrl?: string;
  filePath?: string;
  fileType?: string;
  size?: number;
  width?: number;
  height?: number;
  message?: string;
  help?: string;
}

const UPLOAD_ENDPOINT = 'https://upload.imagekit.io/api/v1/files/upload';
const REQUEST_TIMEOUT_MS = 60000;

/**
 * ImageKit V1 file upload (https://imagekit.io/docs/api-reference/upload-file/upload-file).
 *
 * Auth is HTTP Basic with the private key as the username and an empty
 * password — i.e. base64("private_key:"). The private key never leaves the
 * server; browsers that need to upload directly require the separate
 * signature/token flow, which this service deliberately does not implement.
 */
@Injectable()
export class ImageKitService {
  private readonly logger = new Logger(ImageKitService.name);
  private readonly privateKey: string;
  private readonly baseFolder: string;

  constructor(private readonly config: ConfigService) {
    this.privateKey = ImageKitService.normalizeKey(
      this.config.get<string>('IMAGEKIT_PRIVATE_KEY') || '',
    );
    this.baseFolder =
      this.config.get<string>('IMAGEKIT_UPLOAD_FOLDER')?.trim() || 'elevare';

    if (!this.privateKey) {
      this.logger.warn(
        'IMAGEKIT_PRIVATE_KEY not set — ImageKit uploads will fail until it is configured.',
      );
    } else if (!this.privateKey.startsWith('private_')) {
      this.logger.warn(
        'IMAGEKIT_PRIVATE_KEY does not start with "private_" — this looks like a public key.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.privateKey);
  }

  private static normalizeKey(raw: string): string {
    let key = raw.trim().replace(/^["']|["']$/g, '');
    if (key.toLowerCase().startsWith('basic ')) {
      key = key.slice(6).trim();
    }
    // A private key used as basic-auth username is often pasted with the
    // trailing colon that curl's `-u key:` form requires.
    return key.replace(/:$/, '');
  }

  private assertConfigured(): void {
    if (!this.privateKey) {
      throw new ServiceUnavailableException(
        'File uploads are not configured on this server. Set IMAGEKIT_PRIVATE_KEY.',
      );
    }
  }

  /** ImageKit accepts alphanumerics, `.`, `_` and `-` in file names. */
  static sanitizeFileName(name: string, fallback = 'upload'): string {
    const base = (name || '')
      .split(/[\\/]/)
      .pop()!
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[._-]+/, '');

    if (!base || base === '.') return fallback;
    // Leave room for ImageKit's uniqueness suffix.
    return base.length > 120 ? base.slice(-120) : base;
  }

  /**
   * Join the configured base folder with a caller-supplied subfolder.
   *
   * Dot-only segments (`.`, `..`) are dropped: without that, a `folder` of
   * `../../x` would climb out of the caller's own folder, since `.` is
   * otherwise a legal character in an ImageKit path.
   */
  buildFolder(subFolder?: string): string {
    const cleaned = (subFolder || '')
      .split('/')
      .map((segment) => segment.trim().replace(/[^a-zA-Z0-9._-]/g, '_'))
      .filter((segment) => segment && !/^\.+$/.test(segment))
      .join('/');
    return cleaned ? `/${this.baseFolder}/${cleaned}` : `/${this.baseFolder}`;
  }

  /**
   * Upload a buffer to ImageKit.
   *
   * `useUniqueFileName` is always on, so two users uploading `photo.jpg`
   * never collide and an upload can never overwrite an existing asset.
   */
  async uploadFile(
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    options: { folder?: string; fileName?: string; tags?: string[] } = {},
  ): Promise<ImageKitUploadResult> {
    this.assertConfigured();

    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

    const fileName = ImageKitService.sanitizeFileName(
      options.fileName || file.originalname || 'upload',
    );
    const folder = this.buildFolder(options.folder);

    const form = new FormData();
    form.append(
      'file',
      // Copy into a plain Uint8Array: a Node Buffer may be backed by a shared
      // pool slice, which is not a valid BlobPart.
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/octet-stream',
      }),
      fileName,
    );
    form.append('fileName', fileName);
    form.append('folder', folder);
    form.append('useUniqueFileName', 'true');
    if (options.tags?.length) {
      form.append('tags', options.tags.join(','));
    }

    let response: Response;
    try {
      response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          // base64("<private key>:") — private key as username, no password.
          Authorization: `Basic ${Buffer.from(`${this.privateKey}:`).toString('base64')}`,
        },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[imagekit] network_error upload error=${message}`);
      throw new ServiceUnavailableException(
        'Could not reach the file storage service. Please try again shortly.',
      );
    }

    let data: ImageKitUploadResponse;
    try {
      data = (await response.json()) as ImageKitUploadResponse;
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data?.message || response.statusText || 'Upload failed';
      this.logger.warn(
        `[imagekit] api_error upload http=${response.status} message=${message}`,
      );
      throw ImageKitService.toHttpException(response.status, message);
    }

    if (!data?.url || !data?.fileId) {
      this.logger.warn('[imagekit] upload_ok_without_url — unexpected response shape');
      throw new ServiceUnavailableException(
        'File storage returned an unexpected response. Please try again.',
      );
    }

    this.logger.log(
      `[imagekit] upload ok fileId=${data.fileId} path=${data.filePath ?? 'n/a'} size=${data.size ?? 'n/a'}`,
    );

    return {
      fileId: data.fileId,
      name: data.name ?? fileName,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl ?? null,
      filePath: data.filePath ?? '',
      fileType: data.fileType ?? 'other',
      size: data.size ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
    };
  }

  /**
   * 401/403 mean our key is wrong — that is our problem, not the caller's, so
   * it must not surface as "your file is invalid".
   */
  private static toHttpException(status: number, message: string) {
    if (status === 401 || status === 403) {
      return new ServiceUnavailableException(
        'File uploads are temporarily unavailable. Please try again later.',
      );
    }
    if (status === 429) {
      return new ServiceUnavailableException(
        'Too many uploads right now. Please try again in a few minutes.',
      );
    }
    if (status >= 500) {
      return new ServiceUnavailableException(
        'The file storage service is temporarily unavailable. Please try again later.',
      );
    }
    return new BadRequestException(message);
  }
}
