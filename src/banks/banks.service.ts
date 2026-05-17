import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaystackService } from '../common/services/paystack.service';
import { EmailService } from '../common/services/email.service';
import { WalletService } from '../wallet/wallet.service';
import { AddBankDto } from './dto/add-bank.dto';
import { VerifyWithdrawalOtpDto } from './dto/verify-withdrawal-otp.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import {
  assertPaystackAccountNameMatchesProfile,
  assertProfileHasLegalNames,
  MAX_BANK_ACCOUNTS_PER_USER,
} from '../common/utils/profile-legal-name.util';

@Injectable()
export class BanksService {
  private readonly logger = new Logger(BanksService.name);

  constructor(
    private prisma: PrismaService,
    private paystackService: PaystackService,
    private emailService: EmailService,
    private walletService: WalletService,
  ) {}

  /**
   * Get list of banks from Paystack
   */
  async listBanks() {
    try {
      const banks = await this.paystackService.getBanks();
      return {
        message: 'Banks retrieved successfully',
        data: banks,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve banks. Please try again later.');
    }
  }

  /**
   * Add bank account
   */
  async addBankAccount(userId: string, addBankDto: AddBankDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    assertProfileHasLegalNames(user.profile);

    const accountCount = await (this.prisma as any).bankAccount.count({
      where: { userId },
    });

    if (accountCount >= MAX_BANK_ACCOUNTS_PER_USER) {
      throw new BadRequestException(
        `You can only save up to ${MAX_BANK_ACCOUNTS_PER_USER} bank accounts. Delete an existing account before adding another.`,
      );
    }

    // Verify account with Paystack
    let accountVerification;
    try {
      accountVerification = await this.paystackService.verifyAccount(
        addBankDto.accountNumber,
        addBankDto.bankCode,
      );
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify bank account. Please check the account number and bank code.',
      );
    }

    assertPaystackAccountNameMatchesProfile(
      {
        firstName: user.profile!.firstName!,
        lastName: user.profile!.lastName!,
      },
      accountVerification.data.account_name,
    );

    // Check if account already exists
    const existingAccount = await (this.prisma as any).bankAccount.findFirst({
      where: {
        userId,
        accountNumber: addBankDto.accountNumber,
        bankCode: addBankDto.bankCode,
      },
    });

    if (existingAccount) {
      throw new BadRequestException('This bank account has already been added');
    }

    // Get bank name from Paystack banks list
    const banks = await this.paystackService.getBanks();
    const bank = banks.find((b) => b.code === addBankDto.bankCode);
    const bankName = bank?.name || 'Unknown Bank';

    // Create transfer recipient in Paystack
    let recipientCode: string | null = null;
    try {
      const recipient = await this.paystackService.createTransferRecipient(
        addBankDto.accountNumber,
        addBankDto.bankCode,
        accountVerification.data.account_name,
      );
      recipientCode = recipient.data.recipient_code;
    } catch (error) {
      this.logger.warn(`Failed to create Paystack recipient: ${error.message}`);
      // Continue without recipient code - can be created later
    }

    // Check if user has any default account
    const hasDefault = await (this.prisma as any).bankAccount.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    // Create bank account
    const bankAccount = await (this.prisma as any).bankAccount.create({
      data: {
        userId,
        accountNumber: addBankDto.accountNumber,
        accountName: accountVerification.data.account_name,
        bankCode: addBankDto.bankCode,
        bankName,
        isVerified: true,
        isDefault: !hasDefault, // Set as default if user has no default account
        paystackRecipientCode: recipientCode,
      },
    });

    return {
      message: 'Bank account added and verified successfully',
      data: bankAccount,
    };
  }

  /**
   * Get user's bank accounts
   */
  async getBankAccounts(userId: string) {
    const bankAccounts = await (this.prisma as any).bankAccount.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      message: 'Bank accounts retrieved successfully',
      data: bankAccounts,
    };
  }

  /**
   * Set default bank account
   */
  async setDefaultBankAccount(userId: string, bankAccountId: string) {
    const bankAccount = await (this.prisma as any).bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId,
      },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    // Unset all other default accounts
    await (this.prisma as any).bankAccount.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this as default
    const updated = await (this.prisma as any).bankAccount.update({
      where: { id: bankAccountId },
      data: { isDefault: true },
    });

    return {
      message: 'Default bank account updated successfully',
      data: updated,
    };
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(userId: string, bankAccountId: string) {
    const bankAccount = await (this.prisma as any).bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId,
      },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    await (this.prisma as any).bankAccount.delete({
      where: { id: bankAccountId },
    });

    return {
      message: 'Bank account deleted successfully',
    };
  }

  /**
   * Request withdrawal OTP
   */
  async requestWithdrawalOtp(userId: string, withdrawDto: RequestWithdrawalDto) {
    if (withdrawDto.amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    const balanceResult = await this.walletService.getBalance(userId);
    const balance = new Decimal(balanceResult.data.balance);
    const withdrawalAmount = new Decimal(withdrawDto.amount);

    if (balance.lessThan(withdrawalAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const bankAccount = await (this.prisma as any).bankAccount.findFirst({
      where: {
        id: withdrawDto.bankId,
        userId,
        isVerified: true,
      },
    });

    if (!bankAccount) {
      throw new NotFoundException(
        'Bank account not found or not verified. Please add a valid bank account first.',
      );
    }

    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await (this.prisma as any).withdrawalOtp.updateMany({
      where: {
        userId,
        used: false,
      },
      data: {
        used: true,
      },
    });

    const withdrawalRequest = await (this.prisma as any).withdrawalOtp.create({
      data: {
        userId,
        otp,
        amount: withdrawalAmount,
        bankAccountId: bankAccount.id,
        expiresAt,
        used: false,
      },
    });

    try {
      await this.emailService.sendWithdrawalOTP(user.email, otp);
    } catch (error) {
      this.logger.warn(
        `Withdrawal OTP email failed for ${user.email}: ${error.message}`,
      );
    }

    return {
      message:
        'Withdrawal OTP generated. Complete withdrawal with POST /banks/withdrawal/verify-otp.',
      data: {
        withdrawalRequestId: withdrawalRequest.id,
        otp,
        expiresIn: 600,
        amount: withdrawDto.amount,
        bankId: bankAccount.id,
        bankAccount: {
          accountName: bankAccount.accountName,
          accountNumber: bankAccount.accountNumber,
          bankName: bankAccount.bankName,
        },
      },
    };
  }

  /**
   * Verify withdrawal OTP and process withdrawal
   */
  async verifyWithdrawalOtp(
    userId: string,
    verifyOtpDto: VerifyWithdrawalOtpDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const withdrawalOtp = await (this.prisma as any).withdrawalOtp.findFirst({
      where: {
        id: verifyOtpDto.withdrawalRequestId,
        userId,
        otp: verifyOtpDto.otp,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!withdrawalOtp) {
      throw new BadRequestException(
        'Invalid or expired withdrawal request. Check withdrawalRequestId and OTP, or request a new one.',
      );
    }

    if (!withdrawalOtp.amount || !withdrawalOtp.bankAccountId) {
      throw new BadRequestException(
        'Withdrawal session is incomplete. Please request a new OTP.',
      );
    }

    const bankAccount = await (this.prisma as any).bankAccount.findFirst({
      where: {
        id: withdrawalOtp.bankAccountId,
        userId,
        isVerified: true,
      },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found or not verified');
    }

    const balanceCheck = await this.walletService.getBalance(userId);
    const currentBalance = new Decimal(balanceCheck.data.balance);
    const withdrawalAmount = new Decimal(withdrawalOtp.amount);
    const withdrawAmountNumber = Number(withdrawalOtp.amount);

    if (withdrawalAmount.lte(0)) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    if (currentBalance.lessThan(withdrawalAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Mark OTP as used
    await (this.prisma as any).withdrawalOtp.update({
      where: { id: withdrawalOtp.id },
      data: {
        used: true,
      },
    });

    // Process withdrawal via Paystack
    if (!bankAccount.paystackRecipientCode) {
      // Create recipient if not exists
      try {
        const recipient = await this.paystackService.createTransferRecipient(
          bankAccount.accountNumber,
          bankAccount.bankCode,
          bankAccount.accountName,
        );
        await (this.prisma as any).bankAccount.update({
          where: { id: bankAccount.id },
          data: { paystackRecipientCode: recipient.data.recipient_code },
        });
        bankAccount.paystackRecipientCode = recipient.data.recipient_code;
      } catch (error) {
        throw new BadRequestException(
          'Failed to create transfer recipient. Please try again.',
        );
      }
    }

    // Initiate transfer
    let transferResponse;
    try {
      transferResponse = await this.paystackService.initiateTransfer(
        bankAccount.paystackRecipientCode,
        withdrawAmountNumber,
        `Withdrawal to ${bankAccount.accountName}`,
      );
    } catch (error) {
      throw new BadRequestException(
        'Failed to process withdrawal. Please try again later.',
      );
    }

    // Create withdrawal transaction
    const withdrawalTx = await this.prisma.walletTransaction.create({
      data: {
        userId,
        transactionType: 'DEBIT',
        amount: withdrawalAmount,
        balanceAfter: currentBalance.sub(withdrawalAmount),
        transactionCategory: 'WITHDRAWAL',
        description: `Withdrawal to ${bankAccount.accountName} - ${bankAccount.accountNumber}`,
        status: transferResponse.data.status === 'success' ? 'COMPLETED' : 'PENDING',
        referenceId: transferResponse.data.transfer_code,
      },
    });

    // Create notification
    await this.prisma.notification.create({
      data: {
        receiverId: userId,
        type: transferResponse.data.status === 'success' ? 'WITHDRAWAL_PROCESSED' : 'WITHDRAWAL_FAILED',
        title: transferResponse.data.status === 'success' ? 'Withdrawal Processed' : 'Withdrawal Pending',
        message: transferResponse.data.status === 'success'
          ? `Your withdrawal of ₦${withdrawAmountNumber} has been processed`
          : `Your withdrawal of ₦${withdrawAmountNumber} is being processed`,
        data: {
          transactionId: withdrawalTx.id,
          amount: withdrawAmountNumber,
          bankId: bankAccount.id,
          transferCode: transferResponse.data.transfer_code,
        },
      },
    });

    const paystackMocked = this.paystackService.isMockTransfersEnabled();

    return {
      message: paystackMocked
        ? 'Withdrawal recorded successfully (Paystack transfer mocked — no real bank payout)'
        : 'Withdrawal processed successfully',
      data: {
        transactionId: withdrawalTx.id,
        amount: withdrawAmountNumber,
        bankId: bankAccount.id,
        status: transferResponse.data.status === 'success' ? 'COMPLETED' : 'PENDING',
        transferCode: transferResponse.data.transfer_code,
        paystackMocked,
        bankAccount: {
          accountName: bankAccount.accountName,
          accountNumber: bankAccount.accountNumber,
          bankName: bankAccount.bankName,
        },
      },
    };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

