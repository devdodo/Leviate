import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralStatus, TransactionCategory, TransactionType, TransactionStatus } from '@prisma/client';
import { WithdrawDto } from '../wallet/dto/withdraw.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReferralsService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  async getReferralCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Referral code retrieved successfully',
      data: {
        referralCode: user.referralCode,
      },
    };
  }

  async getReferralHistory(userId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Referral history retrieved successfully',
      data: referrals,
    };
  }

  /**
   * Get referral earnings balance
   */
  async getReferralBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate referral earnings (all REFERRAL_BONUS credits)
    const referralTransactions = await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        transactionCategory: TransactionCategory.REFERRAL_BONUS,
        transactionType: TransactionType.CREDIT,
        status: TransactionStatus.COMPLETED,
      },
      select: {
        amount: true,
      },
    });

    let referralBalance = new Decimal(0);
    for (const tx of referralTransactions) {
      referralBalance = referralBalance.add(tx.amount);
    }

    return {
      message: 'Referral balance retrieved successfully',
      data: {
        referralBalance: referralBalance.toString(),
        currency: 'NGN',
      },
    };
  }

  async applyReferralCode(userId: string, referralCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.referredById) {
      throw new BadRequestException('You have already used a referral code');
    }

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      throw new NotFoundException('Invalid referral code');
    }

    if (referrer.id === userId) {
      throw new BadRequestException('Cannot use your own referral code');
    }

    // Update user with referrer
    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    // Create referral record
    const referral = await this.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: userId,
        status: ReferralStatus.PENDING,
      },
    });

    return {
      message: 'Referral code applied successfully',
      data: referral,
    };
  }

  async processReferralReward(referredUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: referredUserId },
      include: {
        referredBy: true,
      },
    });

    if (!user || !user.referredById) {
      return; // No referrer
    }

    const referral = await this.prisma.referral.findFirst({
      where: {
        referrerId: user.referredById,
        referredId: referredUserId,
        status: ReferralStatus.PENDING,
      },
    });

    if (!referral) {
      return; // Already processed or doesn't exist
    }

    // Get reward amount from config (default 100)
    const rewardAmount = 100; // TODO: Get from config

    // Credit referrer
    await this.walletService.credit(
      user.referredById,
      rewardAmount,
      'REFERRAL_BONUS',
      `Referral reward for ${user.email}`,
      { referralId: referral.id },
    );

    // Mark referral as completed
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Create notification
    await this.prisma.notification.create({
      data: {
        receiverId: user.referredById,
        type: 'REFERRAL_REWARD',
        title: 'Referral Reward',
        message: `You received ₦${rewardAmount} for referring ${user.email}`,
        data: {
          referralId: referral.id,
          amount: rewardAmount,
        },
      },
    });
  }

  /**
   * Withdraw from referral earnings to main wallet
   * This allows users to specifically withdraw their referral earnings
   */
  /**
   * Withdraw from referral earnings to main wallet
   * Note: To withdraw to bank account, use the banks endpoints with OTP verification
   */
  async withdrawFromReferral(userId: string, withdrawDto: WithdrawDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get referral balance
    const referralBalanceResult = await this.getReferralBalance(userId);
    const referralBalance = new Decimal(referralBalanceResult.data.referralBalance);
    const withdrawalAmount = new Decimal(withdrawDto.amount);

    // Check if user has enough referral earnings
    if (referralBalance.lessThan(withdrawalAmount)) {
      throw new BadRequestException(
        `Insufficient referral balance. Available: ₦${referralBalance.toString()}`,
      );
    }

    // Get current balance from wallet service
    const balanceResult = await this.walletService.getBalance(userId);
    const currentBalance = new Decimal(balanceResult.data.balance);

    // Check overall balance (must have enough in main wallet too)
    if (currentBalance.lessThan(withdrawalAmount)) {
      throw new BadRequestException('Insufficient balance in main wallet');
    }

    // Check NIN verification
    if (!user.ninVerified) {
      throw new ForbiddenException(
        'NIN verification required for withdrawal. Please verify your NIN first.',
      );
    }

    // Create withdrawal transaction with reference to referral
    const withdrawalTx = await this.prisma.walletTransaction.create({
      data: {
        userId,
        transactionType: TransactionType.DEBIT,
        amount: withdrawalAmount,
        balanceAfter: currentBalance.sub(withdrawalAmount),
        transactionCategory: TransactionCategory.WITHDRAWAL,
        description: `Withdrawal from referral earnings: ${withdrawDto.bankDetails || 'N/A'}`,
        status: TransactionStatus.COMPLETED,
      },
    });

    // Create notification
    await this.prisma.notification.create({
      data: {
        receiverId: userId,
        type: 'WITHDRAWAL_PROCESSED',
        title: 'Referral Earnings Withdrawal Processed',
        message: `Your withdrawal of ₦${withdrawDto.amount} from referral earnings has been processed`,
        data: {
          transactionId: withdrawalTx.id,
          amount: withdrawDto.amount,
          source: 'referral_earnings',
        },
      },
    });

    return {
      message: 'Withdrawal from referral earnings processed successfully',
      data: {
        transactionId: withdrawalTx.id,
        amount: withdrawDto.amount,
        source: 'referral_earnings',
        remainingReferralBalance: referralBalance.sub(withdrawalAmount).toString(),
        status: TransactionStatus.COMPLETED,
      },
    };
  }
}

