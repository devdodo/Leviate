import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm: string;
  private readonly key: Buffer;
  private readonly ivLength: number;

  constructor(private configService: ConfigService) {
    this.algorithm = this.configService.get<string>('ENCRYPTION_ALGORITHM') || 'aes-256-gcm';
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (!encryptionKey || encryptionKey === 'your-32-byte-encryption-key-base64') {
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        this.logger.warn(
          '⚠️  ENCRYPTION_KEY not set or using placeholder. Using a dummy key for development. ' +
          'Generate a key with: openssl rand -base64 32'
        );
        this.key = Buffer.alloc(32); // Dummy key for development
      } else {
        throw new Error(
          'ENCRYPTION_KEY is required in production. ' +
          'Generate a 32-byte base64 key with: openssl rand -base64 32'
        );
      }
    } else {
      try {
        // Convert base64 key to buffer (should be 32 bytes for AES-256)
        this.key = Buffer.from(encryptionKey, 'base64');
        if (this.key.length !== 32) {
          throw new Error(
            `ENCRYPTION_KEY must be 32 bytes when decoded from base64. ` +
            `Current length: ${this.key.length} bytes. ` +
            `Generate a valid key with: openssl rand -base64 32`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
          throw error;
        }
        throw new Error(
          `ENCRYPTION_KEY is not valid base64. ` +
          `Generate a valid key with: openssl rand -base64 32`
        );
      }
    }

    this.ivLength = parseInt(
      this.configService.get<string>('ENCRYPTION_IV_LENGTH') || '16',
      10,
    );
  }

  /**
   * Encrypt sensitive data (e.g., NIN numbers)
   */
  encrypt(text: string): string {
    if (!text) return text;

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = (cipher as any).getAuthTag();

      // Return iv:encrypted:authTag (all hex encoded)
      return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`, error.stack);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`, error.stack);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash data (one-way, for verification)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

