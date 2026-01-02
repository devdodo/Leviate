import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReputationService } from '../reputation/reputation.service';
import { ConfigService } from '@nestjs/config';
import { UserType } from '@prisma/client';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly minReputationForRecommendation: number;

  constructor(
    private prisma: PrismaService,
    private reputationService: ReputationService,
    private configService: ConfigService,
  ) {
    this.minReputationForRecommendation = parseInt(
      this.configService.get<string>('MIN_REPUTATION_FOR_AUTO_APPROVAL') || '75',
      10,
    );
  }

  /**
   * Get recommended contributors (taskers) for a task
   * Based on reputation score and other factors
   */
  async getRecommendedTaskers(
    taskId: string,
    limit: number = 10,
  ): Promise<Array<{
    id: string;
    email: string;
    reputationScore: number;
    reputationTier: string;
    completedTasks: number;
    successRate: number;
  }>> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, creatorId: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get taskers with good reputation
    const eligibleTaskers = await this.prisma.user.findMany({
      where: {
        userType: UserType.CONTRIBUTOR,
        reputationScore: { gte: this.minReputationForRecommendation },
        status: 'ACTIVE',
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        reputationScore: true,
        taskApplications: {
          where: {
            status: { in: ['COMPLETED', 'APPROVED'] },
          },
          select: {
            id: true,
            submissions: {
              where: {
                verificationStatus: 'VERIFIED',
              },
            },
          },
        },
      },
      orderBy: {
        reputationScore: 'desc',
      },
      take: limit * 2, // Get more to filter
    });

    // Calculate success rate and filter
    const taskersWithStats = eligibleTaskers
      .map((tasker) => {
        const totalApplications = tasker.taskApplications.length;
        const successfulTasks = tasker.taskApplications.filter(
          (app) => app.submissions.some((sub) => sub.verificationStatus === 'VERIFIED'),
        ).length;

        const successRate = totalApplications > 0 ? (successfulTasks / totalApplications) * 100 : 0;

        return {
          id: tasker.id,
          email: tasker.email,
          reputationScore: tasker.reputationScore,
          reputationTier: this.reputationService.getReputationTier(tasker.reputationScore),
          completedTasks: successfulTasks,
          successRate: Math.round(successRate * 100) / 100,
        };
      })
      .filter((tasker) => tasker.reputationScore >= this.minReputationForRecommendation)
      .sort((a, b) => {
        // Sort by reputation score first, then success rate
        if (b.reputationScore !== a.reputationScore) {
          return b.reputationScore - a.reputationScore;
        }
        return b.successRate - a.successRate;
      })
      .slice(0, limit);

    this.logger.log(
      `Found ${taskersWithStats.length} recommended taskers for task ${taskId}`,
    );

    return taskersWithStats;
  }

  /**
   * Check if a tasker is recommended for a task
   */
  async isRecommendedForTask(taskerId: string, taskId: string): Promise<boolean> {
    const tasker = await this.prisma.user.findUnique({
      where: { id: taskerId },
      select: { reputationScore: true, userType: true },
    });

    if (!tasker || tasker.userType !== UserType.CONTRIBUTOR) {
      return false;
    }

    return tasker.reputationScore >= this.minReputationForRecommendation;
  }

  /**
   * Get top contributors by reputation
   */
  async getTopContributors(limit: number = 20): Promise<Array<{
    id: string;
    email: string;
    reputationScore: number;
    reputationTier: string;
    completedTasks: number;
  }>> {
    const topTaskers = await this.prisma.user.findMany({
      where: {
        userType: UserType.CONTRIBUTOR,
        status: 'ACTIVE',
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        reputationScore: true,
        taskApplications: {
          where: {
            status: 'COMPLETED',
            submissions: {
              some: {
                verificationStatus: 'VERIFIED',
              },
            },
          },
        },
      },
      orderBy: {
        reputationScore: 'desc',
      },
      take: limit,
    });

    return topTaskers.map((tasker) => ({
      id: tasker.id,
      email: tasker.email,
      reputationScore: tasker.reputationScore,
      reputationTier: this.reputationService.getReputationTier(tasker.reputationScore),
      completedTasks: tasker.taskApplications.length,
    }));
  }

  /**
   * Get recommended tasks for a tasker (based on their reputation)
   */
  async getRecommendedTasksForTasker(
    taskerId: string,
    limit: number = 10,
  ): Promise<Array<{
    id: string;
    title: string;
    budgetPerTask: number;
    status: string;
    platforms: any;
  }>> {
    const tasker = await this.prisma.user.findUnique({
      where: { id: taskerId },
      select: { reputationScore: true, userType: true },
    });

    if (!tasker || tasker.userType !== UserType.CONTRIBUTOR) {
      return [];
    }

    // Get active tasks that the tasker hasn't applied to
    const appliedTaskIds = await this.prisma.taskApplication
      .findMany({
        where: { taskerId },
        select: { taskId: true },
      })
      .then((apps) => apps.map((app) => app.taskId));

    const recommendedTasks = await this.prisma.task.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: appliedTaskIds },
      },
      select: {
        id: true,
        title: true,
        budgetPerTask: true,
        status: true,
        platforms: true,
      },
      orderBy: {
        budgetPerTask: 'desc', // Higher paying tasks first
      },
      take: limit,
    });

    // Convert Decimal to number and enum to string
    return recommendedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      budgetPerTask: Number(task.budgetPerTask),
      status: task.status.toString(),
      platforms: task.platforms,
    }));
  }
}

