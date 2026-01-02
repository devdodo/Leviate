import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);
  private readonly minReputation: number;
  private readonly maxReputation: number;
  private readonly defaultReputation: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.minReputation = parseInt(
      this.configService.get<string>('MIN_REPUTATION_SCORE') || '0',
      10,
    );
    this.maxReputation = parseInt(
      this.configService.get<string>('MAX_REPUTATION_SCORE') || '100',
      10,
    );
    this.defaultReputation = parseInt(
      this.configService.get<string>('DEFAULT_REPUTATION_SCORE') || '75',
      10,
    );
  }

  /**
   * Get current reputation score for a user
   */
  async getReputationScore(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });

    return user?.reputationScore || this.defaultReputation;
  }

  /**
   * Update reputation score
   * Ensures score stays within bounds (0-100)
   */
  async updateReputationScore(
    userId: string,
    change: number,
    reason: string,
  ): Promise<{ newScore: number; previousScore: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const previousScore = user.reputationScore;
    const newScore = Math.max(
      this.minReputation,
      Math.min(this.maxReputation, previousScore + change),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { reputationScore: newScore },
    });

    this.logger.log(
      `Reputation updated for user ${userId}: ${previousScore} → ${newScore} (${change > 0 ? '+' : ''}${change}) - Reason: ${reason}`,
    );

    return { newScore, previousScore };
  }

  /**
   * Increase reputation (for successful task completion, etc.)
   */
  async increaseReputation(
    userId: string,
    points: number = 5,
    reason: string = 'Task completed successfully',
  ): Promise<number> {
    const { newScore } = await this.updateReputationScore(userId, points, reason);
    return newScore;
  }

  /**
   * Decrease reputation (for failed verification, rejection, etc.)
   */
  async decreaseReputation(
    userId: string,
    points: number = 10,
    reason: string = 'Task verification failed',
  ): Promise<number> {
    const { newScore } = await this.updateReputationScore(userId, -points, reason);
    return newScore;
  }

  /**
   * Check if user meets minimum reputation threshold
   */
  async meetsMinimumReputation(userId: string): Promise<boolean> {
    const score = await this.getReputationScore(userId);
    const minThreshold = parseInt(
      this.configService.get<string>('MIN_REPUTATION_FOR_AUTO_APPROVAL') || '75',
      10,
    );
    return score >= minThreshold;
  }

  /**
   * Get reputation tier/level
   */
  getReputationTier(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  }

  /**
   * Get users eligible for recommendations (reputation >= threshold)
   */
  async getEligibleUsers(
    minReputation: number = 75,
    limit: number = 50,
  ): Promise<Array<{ id: string; reputationScore: number }>> {
    return this.prisma.user.findMany({
      where: {
        reputationScore: { gte: minReputation },
        status: 'ACTIVE',
        emailVerified: true,
      },
      select: {
        id: true,
        reputationScore: true,
      },
      orderBy: {
        reputationScore: 'desc',
      },
      take: limit,
    });
  }
}

