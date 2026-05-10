import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.logger.log('Cloudinary configured');
    } else {
      this.logger.warn(
        'Cloudinary env vars missing — image uploads will fail until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set',
      );
    }
  }

  private ensureConfigured(): void {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Image uploads are not configured on this server',
      );
    }
  }

  maxImageBytes(): number {
    const raw = this.config.get<string>('MAX_FILE_SIZE');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 10 * 1024 * 1024;
  }

  validateImageFile(file: Express.Multer.File): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      throw new BadRequestException(
        `Unsupported image type "${mime}". Allowed: JPEG, PNG, GIF, WebP, AVIF`,
      );
    }
    const max = this.maxImageBytes();
    if (file.size > max) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.round(max / (1024 * 1024))} MB`,
      );
    }
  }

  async uploadImageToCloudinary(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{
    secureUrl: string;
    publicId: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  }> {
    this.ensureConfigured();
    this.validateImageFile(file);

    const baseFolder =
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER')?.trim() || 'elevare';
    const folder = `${baseFolder}/${userId}`;

    try {
      const result = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: 'image',
              unique_filename: true,
              overwrite: false,
            },
            (err, res) => {
              if (err || !res) {
                reject(err || new Error('Cloudinary upload returned no result'));
                return;
              }
              resolve(res);
            },
          );
          stream.end(file.buffer);
        },
      );

      return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (err: any) {
      this.logger.error(`Cloudinary upload failed: ${err?.message || err}`);
      throw new BadRequestException(
        err?.message?.includes?.('Invalid')
          ? err.message
          : 'Failed to upload image. Try another file or format.',
      );
    }
  }
}
