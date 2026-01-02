import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import {
  TransactionType,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get current wallet balance for a user
   */
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate balance from transactions
    const balance = await this.calculateBalance(userId);

    return {
      message: 'Balance retrieved successfully',
      data: {
        balance: balance.toString(),
        currency: 'NGN',
      },
    };
  }

  /**
   * Calculate balance from ledger entries
   */
  private async calculateBalance(userId: string): Promise<Decimal> {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
      },
      select: {
        transactionType: true,
        amount: true,
      },
    });

    let balance = new Decimal(0);

    for (const tx of transactions) {
      if (tx.transactionType === TransactionType.CREDIT) {
        balance = balance.add(tx.amount);
      } else {
        balance = balance.sub(tx.amount);
      }
    }

    return balance;
  }

  /**
   * Credit user wallet (double-entry)
   */
  async credit(
    userId: string,
    amount: number,
    category: TransactionCategory,
    description: string,
    metadata?: any,
  ): Promise<string> {
    const amountDecimal = new Decimal(amount);
    const currentBalance = await this.calculateBalance(userId);
    const balanceAfter = currentBalance.add(amountDecimal);

    // Create credit transaction
    const creditTx = await this.prisma.walletTransaction.create({
      data: {
        userId,
        transactionType: TransactionType.CREDIT,
        amount: amountDecimal,
        balanceAfter,
        transactionCategory: category,
        description,
        referenceId: metadata?.referenceId,
        status: TransactionStatus.COMPLETED,
      },
    });

    return creditTx.id;
  }

  /**
   * Debit user wallet (double-entry)
   */
  async debit(
    userId: string,
    amount: number,
    category: TransactionCategory,
    description: string,
    metadata?: any,
  ): Promise<string> {
    const amountDecimal = new Decimal(amount);
    const currentBalance = await this.calculateBalance(userId);

    if (currentBalance.lessThan(amountDecimal)) {
      throw new BadRequestException('Insufficient balance');
    }

    const balanceAfter = currentBalance.sub(amountDecimal);

    // Create debit transaction
    const debitTx = await this.prisma.walletTransaction.create({
      data: {
        userId,
        transactionType: TransactionType.DEBIT,
        amount: amountDecimal,
        balanceAfter,
        transactionCategory: category,
        description,
        referenceId: metadata?.referenceId,
        status: TransactionStatus.COMPLETED,
      },
    });

    return debitTx.id;
  }

  /**
   * Transfer between users (double-entry)
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description: string,
    metadata?: any,
  ): Promise<{ debitTxId: string; creditTxId: string }> {
    const amountDecimal = new Decimal(amount);

    // Check balance
    const fromBalance = await this.calculateBalance(fromUserId);
    if (fromBalance.lessThan(amountDecimal)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const fromBalanceAfter = fromBalance.sub(amountDecimal);
      const toBalance = await this.calculateBalance(toUserId);
      const toBalanceAfter = toBalance.add(amountDecimal);

      // Create debit transaction
      const debitTx = await tx.walletTransaction.create({
        data: {
          userId: fromUserId,
          transactionType: TransactionType.DEBIT,
          amount: amountDecimal,
          balanceAfter: fromBalanceAfter,
          transactionCategory: TransactionCategory.WITHDRAWAL,
          description,
          status: TransactionStatus.COMPLETED,
        },
      });

      // Create credit transaction (counterpart)
      const creditTx = await tx.walletTransaction.create({
        data: {
          userId: toUserId,
          transactionType: TransactionType.CREDIT,
          amount: amountDecimal,
          balanceAfter: toBalanceAfter,
          transactionCategory: TransactionCategory.DEPOSIT,
          description: `Received: ${description}`,
          counterpartId: debitTx.id,
          status: TransactionStatus.COMPLETED,
        },
      });

      // Link counterpart
      await tx.walletTransaction.update({
        where: { id: debitTx.id },
        data: { counterpartId: creditTx.id },
      });

      return { debitTxId: debitTx.id, creditTxId: creditTx.id };
    });

    return result;
  }

  /**
   * Get transaction history
   */
  async getTransactions(userId: string, query: TransactionQueryDto) {
    const {
      page = 1,
      limit = 10,
      type,
      category,
      status,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (type) where.transactionType = type;
    if (category) where.transactionCategory = category;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Request withdrawal
   * Note: Withdrawals now require OTP verification via BanksService
   * This method is kept for backward compatibility but redirects to OTP flow
   */
  async withdraw(userId: string, withdrawDto: WithdrawDto) {
    throw new BadRequestException(
      'Please use the banks endpoints for withdrawals. Use POST /banks/withdrawal/request-otp to request an OTP, then POST /banks/withdrawal/verify-otp to complete the withdrawal.',
    );
  }

  /**
   * Get wallet statistics
   */
  async getStatistics(userId: string) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
      },
      select: {
        transactionType: true,
        transactionCategory: true,
        amount: true,
      },
    });

    let totalEarned = new Decimal(0);
    let totalSpent = new Decimal(0);
    let totalWithdrawn = new Decimal(0);
    let totalPayouts = new Decimal(0);
    let totalReferrals = new Decimal(0);

    for (const tx of transactions) {
      if (tx.transactionType === TransactionType.CREDIT) {
        totalEarned = totalEarned.add(tx.amount);

        if (tx.transactionCategory === TransactionCategory.TASK_PAYOUT) {
          totalPayouts = totalPayouts.add(tx.amount);
        } else if (tx.transactionCategory === TransactionCategory.REFERRAL_BONUS) {
          totalReferrals = totalReferrals.add(tx.amount);
        }
      } else {
        totalSpent = totalSpent.add(tx.amount);

        if (tx.transactionCategory === TransactionCategory.WITHDRAWAL) {
          totalWithdrawn = totalWithdrawn.add(tx.amount);
        }
      }
    }

    const currentBalance = await this.calculateBalance(userId);

    return {
      message: 'Statistics retrieved successfully',
      data: {
        currentBalance: currentBalance.toString(),
        totalEarned: totalEarned.toString(),
        totalSpent: totalSpent.toString(),
        totalWithdrawn: totalWithdrawn.toString(),
        totalPayouts: totalPayouts.toString(),
        totalReferrals: totalReferrals.toString(),
        currency: 'NGN',
      },
    };
  }

  /**
   * Get ledger entries (detailed)
   */
  async getLedger(userId: string, query: TransactionQueryDto) {
    return this.getTransactions(userId, query);
  }

  /**
   * Verify ledger integrity
   */
  async verifyLedgerIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check that all transactions have proper balance calculations
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by user and verify balance progression
    const userBalances = new Map<string, Decimal>();

    for (const tx of transactions) {
      const userId = tx.userId;
      const currentBalance = userBalances.get(userId) || new Decimal(0);

      let expectedBalance: Decimal;
      if (tx.transactionType === TransactionType.CREDIT) {
        expectedBalance = currentBalance.add(tx.amount);
      } else {
        expectedBalance = currentBalance.sub(tx.amount);
      }

      // Compare with stored balanceAfter
      if (!expectedBalance.equals(tx.balanceAfter)) {
        errors.push(
          `Transaction ${tx.id}: Expected balance ${expectedBalance}, got ${tx.balanceAfter}`,
        );
      }

      userBalances.set(userId, tx.balanceAfter);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

