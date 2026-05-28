import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  PaymentStatus,
  TaskStatus,
  UserType,
  VerificationStatus,
} from '@prisma/client';
import { CreatorAnalyticsPeriod } from './dto/creator-dashboard-analytics-query.dto';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCreatorDashboard(
    userId: string,
    userType: UserType,
    period: CreatorAnalyticsPeriod = CreatorAnalyticsPeriod.WEEK,
  ) {
    if (userType !== UserType.CREATOR) {
      throw new ForbiddenException(
        'Creator dashboard analytics are only available for creator accounts',
      );
    }

    const now = new Date();
    const { currentStart, currentEnd, previousStart, previousEnd } =
      this.resolvePeriodBounds(period, now);

    const [
      taskCompletionOverTime,
      totalTasksCreatedAllTime,
      tasksCreatedCurrentPeriod,
      tasksCreatedPreviousPeriod,
      totalParticipants,
      paidTasks,
    ] = await Promise.all([
      this.buildTaskCompletionSeries(userId, period, currentStart, currentEnd),
      this.prisma.task.count({
        where: {
          creatorId: userId,
          status: { not: TaskStatus.DRAFT },
        },
      }),
      this.prisma.task.count({
        where: {
          creatorId: userId,
          status: { not: TaskStatus.DRAFT },
          createdAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      this.prisma.task.count({
        where: {
          creatorId: userId,
          status: { not: TaskStatus.DRAFT },
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
      this.countDistinctParticipants(userId),
      this.prisma.task.findMany({
        where: {
          creatorId: userId,
          paymentStatus: PaymentStatus.PAID,
        },
        select: {
          budget: true,
          platformFeePercentage: true,
        },
      }),
    ]);

    const totalSpend = paidTasks.reduce(
      (sum, task) => sum + this.campaignSpendAmount(task),
      0,
    );

    const changePercent = this.percentChange(
      tasksCreatedCurrentPeriod,
      tasksCreatedPreviousPeriod,
    );

    return {
      message: 'Creator dashboard analytics retrieved successfully',
      data: {
        period,
        periodStart: currentStart.toISOString(),
        periodEnd: currentEnd.toISOString(),
        taskCompletionOverTime,
        summary: {
          totalTasksCreated: {
            value: totalTasksCreatedAllTime,
            changePercent,
            changeDirection:
              changePercent === null
                ? null
                : changePercent >= 0
                  ? 'up'
                  : 'down',
          },
          totalParticipants: {
            value: totalParticipants,
          },
          totalSpend: {
            value: totalSpend,
            currency: 'NGN',
          },
        },
      },
    };
  }

  private campaignSpendAmount(task: {
    budget: unknown;
    platformFeePercentage: unknown;
  }): number {
    const budget = Number(task.budget ?? 0);
    const feePct = Number(task.platformFeePercentage ?? 0);
    const platformFee = (budget * feePct) / 100;
    return budget + platformFee;
  }

  private async countDistinctParticipants(creatorId: string): Promise<number> {
    const rows = await this.prisma.taskApplication.findMany({
      where: { task: { creatorId } },
      select: { taskerId: true },
      distinct: ['taskerId'],
    });
    return rows.length;
  }

  private async buildTaskCompletionSeries(
    creatorId: string,
    period: CreatorAnalyticsPeriod,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const submissions = await this.prisma.taskSubmission.findMany({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        task: { creatorId },
      },
      select: { verifiedAt: true },
    });

    if (period === CreatorAnalyticsPeriod.WEEK) {
      return this.bucketByWeekday(submissions, periodStart, periodEnd);
    }

    return this.bucketByDay(submissions, periodStart, periodEnd);
  }

  private bucketByWeekday(
    submissions: { verifiedAt: Date | null }[],
    periodStart: Date,
    periodEnd: Date,
  ) {
    const weekStart = this.startOfWeekMonday(periodStart);
    const counts = new Map<string, number>();

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setUTCDate(weekStart.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      counts.set(key, 0);
    }

    for (const row of submissions) {
      if (!row.verifiedAt) continue;
      const key = row.verifiedAt.toISOString().slice(0, 10);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const series: Array<{
      label: string;
      date: string;
      count: number;
      isToday: boolean;
    }> = [];

    const todayKey = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setUTCDate(weekStart.getUTCDate() + i);
      if (day > periodEnd) break;
      const date = day.toISOString().slice(0, 10);
      const jsDay = day.getUTCDay();
      series.push({
        label: DAY_LABELS[jsDay],
        date,
        count: counts.get(date) ?? 0,
        isToday: date === todayKey,
      });
    }

    return series;
  }

  private bucketByDay(
    submissions: { verifiedAt: Date | null }[],
    periodStart: Date,
    periodEnd: Date,
  ) {
    const counts = new Map<string, number>();
    const cursor = new Date(periodStart);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= periodEnd) {
      counts.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const row of submissions) {
      if (!row.verifiedAt) continue;
      const key = row.verifiedAt.toISOString().slice(0, 10);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    return [...counts.entries()].map(([date, count]) => ({
      label: this.formatShortDate(date),
      date,
      count,
      isToday: date === todayKey,
    }));
  }

  private formatShortDate(isoDate: string): string {
    const d = new Date(`${isoDate}T00:00:00.000Z`);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  private resolvePeriodBounds(period: CreatorAnalyticsPeriod, now: Date) {
    if (period === CreatorAnalyticsPeriod.MONTH) {
      const currentStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const currentEnd = now;
      const previousStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const previousEnd = new Date(currentStart.getTime() - 1);
      return { currentStart, currentEnd, previousStart, previousEnd };
    }

    const currentStart = this.startOfWeekMonday(now);
    const currentEnd = now;
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = this.startOfWeekMonday(previousEnd);

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  private startOfWeekMonday(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 100);
  }
}
