import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
  longcode?: string;
  gateway?: string;
  pay_with_bank?: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
}

interface PaystackAccountVerificationResponse {
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
}

interface PaystackTransferRecipientResponse {
  status: boolean;
  message: string;
  data: {
    active: boolean;
    createdAt: string;
    currency: string;
    domain: string;
    id: number;
    integration: number;
    name: string;
    recipient_code: string;
    type: string;
    updatedAt: string;
    is_deleted: boolean;
    details: {
      authorization_code: string | null;
      account_number: string;
      account_name: string;
      bank_code: string;
      bank_name: string;
    };
  };
}

interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data: {
    integration: number;
    domain: string;
    amount: number;
    currency: string;
    source: string;
    reason: string;
    recipient: number;
    status: string;
    transfer_code: string;
    id: number;
    createdAt: string;
    updatedAt: string;
  };
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set. Paystack operations will fail.');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new BadRequestException(
          data.message || `Paystack API error: ${response.statusText}`,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(`Paystack API error: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Paystack service error: ${error.message}`);
    }
  }

  /**
   * Get list of banks
   */
  async getBanks(): Promise<PaystackBank[]> {
    const response = await this.makeRequest<{ status: boolean; data: PaystackBank[] }>(
      '/bank?country=nigeria',
    );
    return response.data;
  }

  /**
   * Verify bank account
   */
  async verifyAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<PaystackAccountVerificationResponse> {
    const response = await this.makeRequest<PaystackAccountVerificationResponse>(
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    );
    return response;
  }

  /**
   * Create transfer recipient
   */
  async createTransferRecipient(
    accountNumber: string,
    bankCode: string,
    accountName: string,
  ): Promise<PaystackTransferRecipientResponse> {
    const response = await this.makeRequest<PaystackTransferRecipientResponse>(
      '/transferrecipient',
      'POST',
      {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      },
    );
    return response;
  }

  /**
   * Initiate transfer
   */
  async initiateTransfer(
    recipientCode: string,
    amount: number, // Amount in kobo (multiply by 100)
    reason?: string,
  ): Promise<PaystackTransferResponse> {
    const response = await this.makeRequest<PaystackTransferResponse>(
      '/transfer',
      'POST',
      {
        source: 'balance',
        amount: amount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: reason || 'Withdrawal',
        reference: `WITHDRAWAL_${Date.now()}`,
      },
    );
    return response;
  }

  /**
   * Verify transfer status
   */
  async verifyTransfer(transferCode: string): Promise<PaystackTransferResponse> {
    const response = await this.makeRequest<PaystackTransferResponse>(
      `/transfer/verify/${transferCode}`,
    );
    return response;
  }
}

