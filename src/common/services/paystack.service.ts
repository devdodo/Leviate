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
  private readonly mockTransfers: boolean;

  constructor(private configService: ConfigService) {
    const raw = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.secretKey = PaystackService.normalizeSecretKey(raw);
    this.mockTransfers = PaystackService.isTruthy(
      this.configService.get<string>('PAYSTACK_MOCK_TRANSFERS'),
    );
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set. Paystack operations will fail.');
    }
    if (this.mockTransfers) {
      this.logger.warn(
        'PAYSTACK_MOCK_TRANSFERS is enabled — withdrawals use simulated Paystack success (no real payout).',
      );
    }
  }

  /** When true, transfer/recipient calls return success without calling Paystack. */
  isMockTransfersEnabled(): boolean {
    return this.mockTransfers;
  }

  private static isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Trim, strip wrapping quotes, remove accidental "Bearer " prefix. */
  private static normalizeSecretKey(raw: string): string {
    let k = raw.trim().replace(/^["']|["']$/g, '');
    if (k.toLowerCase().startsWith('bearer ')) {
      k = k.slice(7).trim();
    }
    return k;
  }

  private assertSecretConfigured(): void {
    if (!this.secretKey) {
      throw new BadRequestException(
        'Payment provider is not configured. Set PAYSTACK_SECRET_KEY to your secret key (starts with sk_test_ or sk_live_).',
      );
    }
    if (!this.secretKey.startsWith('sk_')) {
      throw new BadRequestException(
        'Invalid PAYSTACK_SECRET_KEY. Use the secret key from your Paystack dashboard (starts with sk_test_ or sk_live_).',
      );
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<T> {
    this.assertSecretConfigured();
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
    if (this.mockTransfers) {
      const recipientCode = `MOCK_RCP_${bankCode}_${accountNumber}_${Date.now()}`;
      this.logger.log(
        `Mock transfer recipient created: ${recipientCode} (${accountName})`,
      );
      return {
        status: true,
        message: 'Transfer recipient created (mocked)',
        data: {
          active: true,
          createdAt: new Date().toISOString(),
          currency: 'NGN',
          domain: 'mock',
          id: 0,
          integration: 0,
          name: accountName,
          recipient_code: recipientCode,
          type: 'nuban',
          updatedAt: new Date().toISOString(),
          is_deleted: false,
          details: {
            authorization_code: null,
            account_number: accountNumber,
            account_name: accountName,
            bank_code: bankCode,
            bank_name: 'Mock Bank',
          },
        },
      };
    }

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
    amount: number, // Amount in Naira
    reason?: string,
  ): Promise<PaystackTransferResponse> {
    if (this.mockTransfers) {
      const transferCode = `MOCK_TRF_${Date.now()}`;
      this.logger.log(
        `Mock transfer success: ${transferCode} ₦${amount} → ${recipientCode}`,
      );
      return {
        status: true,
        message: 'Transfer successful (mocked — no funds sent via Paystack)',
        data: {
          integration: 0,
          domain: 'mock',
          amount: amount * 100,
          currency: 'NGN',
          source: 'balance',
          reason: reason || 'Withdrawal',
          recipient: 0,
          status: 'success',
          transfer_code: transferCode,
          id: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    }

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

  /**
   * Initialize payment transaction
   */
  async initializePayment(data: {
    email: string;
    amount: number; // Amount in Naira
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }> {
    const response = await this.makeRequest<{
      status: boolean;
      message: string;
      data: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    }>(
      '/transaction/initialize',
      'POST',
      {
        email: data.email,
        amount: data.amount * 100, // Convert to kobo
        reference: data.reference,
        callback_url: data.callback_url,
        metadata: data.metadata,
      },
    );
    return response;
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(reference: string): Promise<{
    status: boolean;
    message: string;
    data: {
      id: number;
      domain: string;
      status: string;
      reference: string;
      amount: number;
      message: string | null;
      gateway_response: string;
      paid_at: string | null;
      created_at: string;
      channel: string;
      currency: string;
      ip_address: string | null;
      metadata: Record<string, any> | null;
      log: any;
      fees: number | null;
      fees_split: any;
      authorization: {
        authorization_code: string;
        bin: string;
        last4: string;
        exp_month: string;
        exp_year: string;
        channel: string;
        card_type: string;
        bank: string;
        country_code: string;
        brand: string;
        reusable: boolean;
        signature: string;
        account_name: string | null;
      };
      customer: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        email: string;
        customer_code: string;
        phone: string | null;
        metadata: Record<string, any> | null;
        risk_action: string;
        international_format_phone: string | null;
      };
      plan: any;
      split: any;
      order_id: any;
      paidAt: string | null;
      createdAt: string;
      requested_amount: number;
      pos_transaction_data: any;
      source: any;
      fees_breakdown: any;
    };
  }> {
    const response = await this.makeRequest<{
      status: boolean;
      message: string;
      data: any;
    }>(`/transaction/verify/${reference}`);
    return response;
  }
}

