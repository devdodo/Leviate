import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Raw NIMC payload as Dojah returns it under `entity`. */
interface DojahNinLookupResponse {
  entity?: {
    nin?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    gender?: string;
    date_of_birth?: string;
    phone_number?: string;
    // `photo` (base64) is deliberately ignored — we never store it.
  };
  error?: string | { message?: string };
  message?: string;
}

/** Normalized identity, camelCased and stripped of the fields we refuse to keep. */
export interface DojahNinIdentity {
  nin: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  /** True when produced by DOJAH_MOCK_VERIFICATION rather than a real NIMC lookup. */
  mocked: boolean;
}

const DEFAULT_BASE_URL = 'https://sandbox.dojah.io';
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Dojah identity lookups (https://docs.dojah.io).
 *
 * Sandbox and live share identical paths and differ only by base URL:
 *   sandbox -> https://sandbox.dojah.io   live -> https://api.dojah.io
 * Each environment issues its own AppId/secret pair in the Dojah dashboard.
 */
@Injectable()
export class DojahService {
  private readonly logger = new Logger(DojahService.name);
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly secretKey: string;
  private readonly mockVerification: boolean;
  private readonly enforceNameMatch: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('DOJAH_BASE_URL') || DEFAULT_BASE_URL
    )
      .trim()
      .replace(/\/+$/, '');
    this.appId = DojahService.normalizeCredential(
      this.configService.get<string>('DOJAH_APP_ID') || '',
    );
    this.secretKey = DojahService.normalizeCredential(
      this.configService.get<string>('DOJAH_SECRET_KEY') || '',
    );
    this.mockVerification = DojahService.isTruthy(
      this.configService.get<string>('DOJAH_MOCK_VERIFICATION'),
    );
    // Defaults to enforced; only an explicit falsy value turns it off.
    this.enforceNameMatch = !DojahService.isFalsy(
      this.configService.get<string>('DOJAH_ENFORCE_NAME_MATCH'),
    );

    if (this.mockVerification) {
      this.logger.warn(
        'DOJAH_MOCK_VERIFICATION is enabled — NIN lookups are simulated and no NIMC check is performed.',
      );
    } else if (!this.appId || !this.secretKey) {
      this.logger.warn(
        'DOJAH_APP_ID / DOJAH_SECRET_KEY not set. NIN verification will fail until they are configured.',
      );
    }
    if (!this.enforceNameMatch) {
      this.logger.warn(
        'DOJAH_ENFORCE_NAME_MATCH is disabled — NIMC names are not checked against the profile.',
      );
    }
  }

  /** When true, lookups are simulated and never leave the process. */
  isMockEnabled(): boolean {
    return this.mockVerification;
  }

  /**
   * Whether a NIMC/profile name mismatch should block verification. Sandbox
   * returns a fixed test identity that cannot match a real profile, so this is
   * turned off there and left on in production.
   */
  isNameMatchEnforced(): boolean {
    return this.enforceNameMatch;
  }

  isConfigured(): boolean {
    return this.mockVerification || Boolean(this.appId && this.secretKey);
  }

  /** `sandbox` or `live` — surfaced in logs so the environment is never ambiguous. */
  getEnvironment(): 'sandbox' | 'live' {
    return this.baseUrl.includes('sandbox') ? 'sandbox' : 'live';
  }

  private static isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private static isFalsy(value: string | undefined): boolean {
    if (!value) return false;
    const v = value.trim().toLowerCase();
    return v === '0' || v === 'false' || v === 'no';
  }

  /** Trim and strip wrapping quotes plus an accidental "Bearer " prefix. */
  private static normalizeCredential(raw: string): string {
    let value = raw.trim().replace(/^["']|["']$/g, '');
    if (value.toLowerCase().startsWith('bearer ')) {
      value = value.slice(7).trim();
    }
    return value;
  }

  private assertConfigured(): void {
    if (!this.appId || !this.secretKey) {
      throw new ServiceUnavailableException(
        'Identity verification is not configured. Set DOJAH_APP_ID and DOJAH_SECRET_KEY.',
      );
    }
  }

  private async makeRequest<T>(path: string): Promise<T> {
    this.assertConfigured();
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          // Dojah expects the raw secret here — NOT `Bearer <key>`.
          Authorization: this.secretKey,
          AppId: this.appId,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[dojah] network_error GET ${path} error=${message}`);
      throw new ServiceUnavailableException(
        'Could not reach the identity verification service. Please try again shortly.',
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = DojahService.extractErrorMessage(data, response.statusText);
      this.logger.warn(
        `[dojah] api_error GET ${path} env=${this.getEnvironment()} http=${response.status} message=${message}`,
      );
      throw DojahService.toHttpException(response.status, message);
    }

    return data as T;
  }

  private static extractErrorMessage(data: any, fallback: string): string {
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.error?.message === 'string') return data.error.message;
    if (typeof data?.message === 'string') return data.message;
    return fallback || 'Unknown error';
  }

  /**
   * 4xx that the user can act on stays a BadRequest; auth/config problems and
   * 5xx become ServiceUnavailable so we never blame the user for our setup.
   */
  private static toHttpException(status: number, message: string) {
    if (status === 401 || status === 403) {
      return new ServiceUnavailableException(
        'Identity verification is temporarily unavailable. Please try again later.',
      );
    }
    if (status >= 500) {
      return new ServiceUnavailableException(
        'The identity verification service is temporarily unavailable. Please try again later.',
      );
    }
    if (status === 429) {
      return new ServiceUnavailableException(
        'Too many verification attempts right now. Please try again in a few minutes.',
      );
    }
    return new BadRequestException(message);
  }

  /**
   * Look up an identity by NIN via `GET /api/v1/kyc/nin`.
   * Sandbox test NIN: 70123456789.
   *
   * Billed per call — callers must short-circuit already-verified users.
   */
  async lookupNin(nin: string): Promise<DojahNinIdentity> {
    const trimmed = nin.trim();

    if (this.mockVerification) {
      this.logger.log(`[dojah] mock_nin_lookup nin=${DojahService.maskNin(trimmed)}`);
      return {
        nin: trimmed,
        firstName: 'MOCK',
        lastName: 'MOCK',
        middleName: null,
        gender: null,
        dateOfBirth: null,
        phoneNumber: null,
        mocked: true,
      };
    }

    this.logger.log(
      `[dojah] nin_lookup request env=${this.getEnvironment()} nin=${DojahService.maskNin(trimmed)}`,
    );

    const response = await this.makeRequest<DojahNinLookupResponse>(
      `/api/v1/kyc/nin?nin=${encodeURIComponent(trimmed)}`,
    );

    const entity = response?.entity;
    const firstName = entity?.first_name?.trim();
    const lastName = entity?.last_name?.trim();

    if (!entity || !firstName || !lastName) {
      this.logger.warn(
        `[dojah] nin_lookup empty_entity nin=${DojahService.maskNin(trimmed)}`,
      );
      throw new BadRequestException(
        'No identity record was found for that NIN. Please check the number and try again.',
      );
    }

    return {
      nin: entity.nin?.trim() || trimmed,
      firstName,
      lastName,
      middleName: entity.middle_name?.trim() || null,
      gender: entity.gender?.trim() || null,
      dateOfBirth: entity.date_of_birth?.trim() || null,
      phoneNumber: entity.phone_number?.trim() || null,
      mocked: false,
    };
  }

  /** Never log a full NIN. */
  private static maskNin(nin: string): string {
    if (nin.length <= 4) return '***';
    return `${nin.slice(0, 3)}****${nin.slice(-2)}`;
  }
}
