import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { TaskStatus, ApplicationStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getTasksReport(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { creatorId: userId },
      include: {
        _count: {
          select: {
            applications: true,
            submissions: true,
          },
        },
        applications: {
          where: {
            status: ApplicationStatus.APPROVED,
          },
          include: {
            submissions: {
              where: {
                verificationStatus: 'VERIFIED',
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Tasks report retrieved successfully',
      data: tasks,
    };
  }

  async getTaskDetails(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        creatorId: userId,
      },
      include: {
        applications: {
          include: {
            tasker: {
              select: {
                id: true,
                email: true,
                reputationScore: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            submissions: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        _count: {
          select: {
            applications: true,
            submissions: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return {
      message: 'Task details retrieved successfully',
      data: task,
    };
  }

  async getPerformanceMetrics(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { creatorId: userId },
      include: {
        applications: {
          where: {
            status: ApplicationStatus.COMPLETED,
          },
          include: {
            submissions: {
              where: {
                verificationStatus: 'VERIFIED',
              },
            },
          },
        },
      },
    });

    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((t) => t.status === TaskStatus.ACTIVE).length;
    const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;

    let totalSpend = 0;
    let totalCompleted = 0;

    for (const task of tasks) {
      const verifiedSubmissions = task.applications.flatMap((a) => a.submissions);
      totalCompleted += verifiedSubmissions.length;
      totalSpend += verifiedSubmissions.length * Number(task.budgetPerTask);
    }

    const completionRate =
      totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

    return {
      message: 'Performance metrics retrieved successfully',
      data: {
        totalTasks,
        activeTasks,
        completedTasks,
        totalSpend,
        totalCompleted,
        completionRate: completionRate.toFixed(2),
      },
    };
  }
}

