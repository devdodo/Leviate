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
import { TaskStatus, ApplicationStatus, UserType } from '@prisma/client';
// Temporary workaround: Define enums as const objects until TypeScript server refreshes
// These enums exist in the Prisma schema and will be available after migration is applied
const TaskType = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
} as const;
type TaskType = typeof TaskType[keyof typeof TaskType];

const TaskCategory = {
  MAKE_POST: 'MAKE_POST',
  COMMENT_POST: 'COMMENT_POST',
  LIKE_SHARE_SAVE_REPOST: 'LIKE_SHARE_SAVE_REPOST',
  FOLLOW_ACCOUNT: 'FOLLOW_ACCOUNT',
} as const;
type TaskCategory = typeof TaskCategory[keyof typeof TaskCategory];

const ContentType = {
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
} as const;
type ContentType = typeof ContentType[keyof typeof ContentType];

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

    // All tasks are created as DRAFT by default
    // They must be published to become visible to contributors
    const status = TaskStatus.DRAFT;

    // AI brief will be generated when task is published
    const brief = '';
    const llmContext = '';

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
      } as any, // Type assertion needed until migration is applied to database
    });

    return {
      message: 'Task draft created successfully. Publish it to make it visible to contributors.',
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
      // Only show ACTIVE tasks in public view (drafts and other statuses are excluded)
      // Public endpoint should only show published/active tasks
      status: TaskStatus.ACTIVE,
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
    if (updateTaskDto.targeting) updateData.targeting = updateTaskDto.targeting as any;
    if (updateTaskDto.scheduleType) updateData.scheduleType = updateTaskDto.scheduleType;
    if (updateTaskDto.scheduleStart) updateData.scheduleStart = new Date(updateTaskDto.scheduleStart);
    if (updateTaskDto.scheduleEnd) updateData.scheduleEnd = new Date(updateTaskDto.scheduleEnd);
    if (updateTaskDto.commentsInstructions) updateData.commentsInstructions = updateTaskDto.commentsInstructions;
    if (updateTaskDto.hashtags) updateData.hashtags = updateTaskDto.hashtags;
    if (updateTaskDto.buzzwords) updateData.buzzwords = updateTaskDto.buzzwords;

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

    if (user.userType !== ('CONTRIBUTOR' as UserType)) {
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
      // Create new draft (all tasks are created as drafts by default)
      return this.createTask(userId, createTaskDto);
    }
  }

  async publishTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only publish your own tasks');
    }

    if (task.status === TaskStatus.ACTIVE) {
      throw new BadRequestException('Task is already published');
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Cannot publish a completed task');
    }

    // Validate required fields for publishing
    const taskData = task as any;
    const requiredFields = [
      { field: 'title', value: task.title },
      { field: 'taskType', value: taskData.taskType },
      { field: 'category', value: taskData.category },
      { field: 'platforms', value: task.platforms },
      { field: 'scheduleType', value: task.scheduleType },
      { field: 'scheduleStart', value: task.scheduleStart },
      { field: 'budget', value: taskData.budget },
    ];

    const missingFields = requiredFields
      .filter(({ value }) => !value || (Array.isArray(value) && value.length === 0))
      .map(({ field }) => field);

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot publish task. Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    // Validate platforms array
    if (!Array.isArray(task.platforms) || task.platforms.length === 0) {
      throw new BadRequestException('At least one platform is required');
    }

    // Validate budget
    if (!taskData.budget || Number(taskData.budget) <= 0) {
      throw new BadRequestException('Valid budget is required');
    }

    // Generate AI brief
    let brief = '';
    let llmContext = '';

    try {
      const aiResult = await this.aiService.generateTaskBrief({
        title: task.title,
        description: task.description || '',
        platforms: task.platforms as string[],
        category: taskData.category,
        contentType: taskData.contentType,
        targeting: (task.targeting as any) || {},
        commentsInstructions: task.commentsInstructions || '',
        hashtags: (task.hashtags as string[]) || [],
        buzzwords: (task.buzzwords as string[]) || [],
      });
      brief = aiResult.brief;
      llmContext = aiResult.llmContext;
    } catch (error) {
      // Continue with fallback brief if AI fails
      brief = task.description || task.title;
      llmContext = `Task: ${task.title}\n${task.description || ''}`;
    }

    // Update task to ACTIVE status and add AI brief
    const publishedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.ACTIVE,
        aiGeneratedBrief: brief,
        llmContextFile: llmContext,
      } as any,
    });

    return {
      message: 'Task published successfully. It is now visible to contributors.',
      data: publishedTask,
    };
  }

  async getTaskSummary(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
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
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only view summary of your own tasks');
    }

    // Type assertion for new fields (until Prisma client is fully regenerated)
    const taskData = task as any;

    // Format the summary
    const summary = {
      id: task.id,
      status: task.status,
      taskType: taskData.taskType,
      category: taskData.category,
      title: task.title,
      description: task.description,
      platforms: Array.isArray(task.platforms) ? task.platforms : [],
      contentType: taskData.contentType,
      resourceLink: task.resourceLink,
      targeting: task.targeting || {},
      schedule: {
        type: task.scheduleType,
        start: task.scheduleStart,
        end: task.scheduleEnd,
      },
      instructions: {
        comments: task.commentsInstructions,
        hashtags: Array.isArray(task.hashtags) ? task.hashtags : [],
        buzzwords: Array.isArray(task.buzzwords) ? task.buzzwords : [],
      },
      budget: {
        amount: Number(taskData.budget || 0),
        platformFeePercentage: Number(task.platformFeePercentage),
        platformFee: Number(taskData.budget || 0) * (Number(task.platformFeePercentage) / 100),
        netAmount: Number(taskData.budget || 0) * (1 - Number(task.platformFeePercentage) / 100),
      },
      audiencePreferences: task.audiencePreferences || {},
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    return {
      message: 'Task summary retrieved successfully',
      data: summary,
    };
  }
}

