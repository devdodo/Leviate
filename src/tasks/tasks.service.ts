import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AIService } from '../common/services/ai.service';
import { ReputationService } from '../reputation/reputation.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApplyTaskDto } from './dto/apply-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskStatus, ApplicationStatus, UserType, TaskType, TaskCategory, ContentType } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private reputationService: ReputationService,
  ) {}

  async createTask(userId: string, createTaskDto: CreateTaskDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType !== UserType.CREATOR) {
      throw new ForbiddenException('Only creators can create tasks');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email first');
    }

    const isDraft = createTaskDto.saveAsDraft === 'true';
    const status = isDraft ? TaskStatus.DRAFT : TaskStatus.ACTIVE;

    // Generate AI brief if not a draft
    let brief = '';
    let llmContext = '';

    if (!isDraft) {
      try {
        const aiResult = await this.aiService.generateTaskBrief({
          title: createTaskDto.title,
          description: createTaskDto.description,
          platforms: createTaskDto.platforms,
          category: createTaskDto.category,
          contentType: createTaskDto.contentType,
          targeting: createTaskDto.targeting,
          commentsInstructions: createTaskDto.commentsInstructions,
          hashtags: createTaskDto.hashtags,
          buzzwords: createTaskDto.buzzwords,
        });
        brief = aiResult.brief;
        llmContext = aiResult.llmContext;
      } catch (error) {
        // Continue with empty brief if AI fails
        brief = createTaskDto.description || '';
        llmContext = `Task: ${createTaskDto.title}\n${createTaskDto.description || ''}`;
      }
    }

    const task = await this.prisma.task.create({
      data: {
        creatorId: userId,
        taskType: createTaskDto.taskType,
        category: createTaskDto.category,
        title: createTaskDto.title,
        description: createTaskDto.description,
        platforms: createTaskDto.platforms,
        contentType: createTaskDto.contentType,
        resourceLink: createTaskDto.resourceLink,
        audiencePreferences: createTaskDto.audiencePreferences || {},
        targeting: (createTaskDto.targeting || {}) as any,
        scheduleType: createTaskDto.scheduleType,
        scheduleStart: new Date(createTaskDto.scheduleStart),
        scheduleEnd: createTaskDto.scheduleEnd
          ? new Date(createTaskDto.scheduleEnd)
          : null,
        commentsInstructions: createTaskDto.commentsInstructions,
        hashtags: createTaskDto.hashtags || [],
        buzzwords: createTaskDto.buzzwords || [],
        budget: createTaskDto.budget,
        status,
        aiGeneratedBrief: brief,
        llmContextFile: llmContext,
      },
    });

    return {
      message: isDraft
        ? 'Task draft saved successfully'
        : 'Task created successfully',
      data: task,
    };
  }

  async getTasks(query: TaskQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      platform,
      goal,
      minBudget,
      maxBudget,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      status: status || { not: TaskStatus.DRAFT }, // Exclude drafts from public view
    };

    if (platform) {
      where.platforms = { has: platform };
    }

    if (goal) {
      // Support both new category field and legacy goals field
      where.OR = [
        { category: goal },
        { goals: { has: goal } }, // Legacy support
      ];
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      where.budget = {};
      if (minBudget !== undefined) where.budget.gte = minBudget;
      if (maxBudget !== undefined) where.budget.lte = maxBudget;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    // Map legacy field names to new ones
    const sortFieldMap: Record<string, string> = {
      budgetPerTask: 'budget',
      createdAt: 'createdAt',
      scheduleStart: 'scheduleStart',
    };
    const mappedSortBy = sortFieldMap[sortBy] || sortBy;
    orderBy[mappedSortBy] = sortOrder;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          creator: {
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
          _count: {
            select: {
              applications: true,
              submissions: true,
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      message: 'Tasks retrieved successfully',
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getTaskById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
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
        applications: {
          where: {
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.COMPLETED] },
          },
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
      throw new NotFoundException('Task not found');
    }

    return {
      message: 'Task retrieved successfully',
      data: task,
    };
  }

  async updateTask(userId: string, taskId: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Cannot update completed task');
    }

    const updateData: any = {};

    if (updateTaskDto.title) updateData.title = updateTaskDto.title;
    if (updateTaskDto.description) updateData.description = updateTaskDto.description;
    if (updateTaskDto.platforms) updateData.platforms = updateTaskDto.platforms;
    if (updateTaskDto.taskType) updateData.taskType = updateTaskDto.taskType;
    if (updateTaskDto.category) updateData.category = updateTaskDto.category;
    if (updateTaskDto.contentType) updateData.contentType = updateTaskDto.contentType;
    if (updateTaskDto.resourceLink) updateData.resourceLink = updateTaskDto.resourceLink;
    if (updateTaskDto.budget) updateData.budget = updateTaskDto.budget;
    // Legacy support
    if (updateTaskDto.goals) updateData.goals = updateTaskDto.goals;
    if (updateTaskDto.budgetPerTask) updateData.budgetPerTask = updateTaskDto.budgetPerTask;
    if (updateTaskDto.totalBudget) updateData.totalBudget = updateTaskDto.totalBudget;

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return {
      message: 'Task updated successfully',
      data: updatedTask,
    };
  }

  async applyForTask(userId: string, taskId: string, applyTaskDto: ApplyTaskDto) {
    const [task, user] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id: taskId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
      }),
    ]);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType !== UserType.CONTRIBUTOR) {
      throw new ForbiddenException('Only contributors can apply for tasks');
    }

    if (task.status !== TaskStatus.ACTIVE) {
      throw new BadRequestException('Task is not active');
    }

    if (task.creatorId === userId) {
      throw new BadRequestException('Cannot apply for your own task');
    }

    // Check if already applied
    const existingApplication = await this.prisma.taskApplication.findFirst({
      where: {
        taskId,
        taskerId: userId,
      },
    });

    if (existingApplication) {
      throw new BadRequestException('You have already applied for this task');
    }

    // Check reputation
    const meetsMinimum = await this.reputationService.meetsMinimumReputation(userId);

    // Auto-approve if reputation >= 75%
    const status = meetsMinimum
      ? ApplicationStatus.APPROVED
      : ApplicationStatus.PENDING;

    const application = await this.prisma.taskApplication.create({
      data: {
        taskId,
        taskerId: userId,
        status,
      },
    });

    // Create notification for creator
    await this.prisma.notification.create({
      data: {
        receiverId: task.creatorId,
        type: status === ApplicationStatus.APPROVED
          ? 'TASK_APPROVED'
          : 'TASK_APPLIED',
        title: status === ApplicationStatus.APPROVED
          ? 'Task Application Auto-Approved'
          : 'New Task Application',
        message: status === ApplicationStatus.APPROVED
          ? `${user.email} has been auto-approved for task: ${task.title}`
          : `${user.email} applied for task: ${task.title}`,
        data: {
          taskId,
          applicationId: application.id,
        },
      },
    });

    return {
      message: meetsMinimum
        ? 'Application submitted and auto-approved'
        : 'Application submitted successfully',
      data: application,
    };
  }

  async getMyJobs(userId: string, status?: ApplicationStatus) {
    const where: any = { taskerId: userId };

    if (status) {
      where.status = status;
    }

    const applications = await this.prisma.taskApplication.findMany({
      where,
      include: {
        task: {
          include: {
            creator: {
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
        },
        submissions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by status
    const grouped = {
      applied: applications.filter((a) => a.status === ApplicationStatus.PENDING),
      approved: applications.filter((a) => a.status === ApplicationStatus.APPROVED),
      declined: applications.filter((a) => a.status === ApplicationStatus.DECLINED),
      completed: applications.filter((a) => a.status === ApplicationStatus.COMPLETED),
      expired: applications.filter((a) => a.status === ApplicationStatus.EXPIRED),
      ongoing: applications.filter(
        (a) =>
          a.status === ApplicationStatus.APPROVED &&
          a.task.status === TaskStatus.ACTIVE,
      ),
    };

    return {
      message: 'My jobs retrieved successfully',
      data: {
        applications,
        grouped,
      },
    };
  }

  async getMyCreatedTasks(userId: string, status?: TaskStatus) {
    const where: any = { creatorId: userId };

    if (status) {
      where.status = status;
    }

    const tasks = await this.prisma.task.findMany({
      where,
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      message: 'My created tasks retrieved successfully',
      data: tasks,
    };
  }

  async saveDraft(userId: string, taskId: string, createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (task && task.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    if (task) {
      // Update existing draft
      const updated = await this.updateTask(userId, taskId, {
        ...createTaskDto,
        status: TaskStatus.DRAFT,
      } as UpdateTaskDto);
      return {
        message: 'Draft updated successfully',
        data: updated.data,
      };
    } else {
      // Create new draft
      return this.createTask(userId, {
        ...createTaskDto,
        saveAsDraft: 'true',
      });
    }
  }
}

