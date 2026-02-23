import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { AIService } from '../common/services/ai.service';
import { ReputationService } from '../reputation/reputation.service';
import { PaystackService } from '../common/services/paystack.service';
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
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private reputationService: ReputationService,
    private paystackService: PaystackService,
    private configService: ConfigService,
  ) {}

  /**
   * Returns available task types and categories for task creation.
   * Used when the tasker chooses what type of task they want to create.
   */
  getTaskTypes() {
    const categories = [
      {
        value: TaskCategory.LIKE_SHARE_SAVE_REPOST,
        label: 'Engagement (Likes, Repost, Retweet)',
        description: 'Get likes, reposts, shares, or saves on your content',
        amount: 1000,
      },
      {
        value: TaskCategory.COMMENT_POST,
        label: 'Comments',
        description: 'Get comments on your post',
        amount: 2000,
      },
      {
        value: TaskCategory.MAKE_POST,
        label: 'Create Post',
        description: 'Have contributors create and publish a post',
        amount: 5000,
      },
      {
        value: TaskCategory.FOLLOW_ACCOUNT,
        label: 'Follow',
        description: 'Get contributors to follow your account',
        amount: 1000,
      },
    ];

    const taskTypes = [
      { value: TaskType.SINGLE, label: 'One-time', description: 'Single engagement per contributor' },
      { value: TaskType.MULTI, label: 'Multiple', description: 'Multiple engagements per contributor' },
    ];

    const contentTypes = [
      { value: ContentType.VIDEO, label: 'Video' },
      { value: ContentType.TEXT, label: 'Text' },
      { value: ContentType.IMAGE, label: 'Image' },
    ];

    const scheduleTypes = [
      { value: 'FIXED', label: 'Fixed', description: 'Fixed campaign window; work happens within specific dates' },
      { value: 'VARIABLE', label: 'Variable', description: 'Flexible schedule; work can be done across a wider timeframe' },
    ];

    return {
      message: 'Task types retrieved successfully',
      data: {
        categories: taskTypes,
        taskTypes: categories,
        contentTypes,
        scheduleTypes,
      },
    };
  }

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

    // Generate AI summary for prospective contributors
    let contributorSummary = '';
    try {
      contributorSummary = await this.aiService.generateTaskSummaryForContributors({
        title: createTaskDto.title,
        description: createTaskDto.description,
        platforms: [createTaskDto.platform],
        category: createTaskDto.category,
        contentType: createTaskDto.contentType,
        budget: createTaskDto.budget,
        targeting: createTaskDto.targeting,
        scheduleStart: createTaskDto.scheduleStart,
        scheduleEnd: createTaskDto.scheduleEnd,
        commentsInstructions: createTaskDto.commentsInstructions,
        hashtags: createTaskDto.hashtags,
        buzzwords: createTaskDto.buzzwords,
      });
    } catch (error) {
      // Log error but continue with task creation
      this.logger.error(`Failed to generate contributor summary: ${error.message}`);
      // Fallback summary will be generated by the AI service
      contributorSummary = '';
    }

    // Create task as draft only. Payment is required before publishing.
    const task = await this.prisma.task.create({
      data: {
        creatorId: userId,
        taskType: createTaskDto.taskType,
        category: createTaskDto.category,
        title: createTaskDto.title,
        description: createTaskDto.description,
        platforms: [createTaskDto.platform],
        contentType: createTaskDto.contentType,
        resourceLink: createTaskDto.category === 'MAKE_POST' ? null : createTaskDto.resourceLink,
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
        contributorSummary: contributorSummary || null,
        paymentStatus: 'PENDING' as any,
      } as any,
    });

    return {
      message: 'Task draft created successfully. Complete payment and then publish when ready.',
      data: task,
    };
  }

  /**
   * Parse age range from target audience string
   * Examples: "18-35", "18-24", "25-34", "13-17", "18+", "25+"
   */
  private parseAgeRange(targetAudience: string): { minAge?: number; maxAge?: number } | null {
    // Match patterns like "18-35", "18-24", "25-34"
    const rangeMatch = targetAudience.match(/(\d+)-(\d+)/);
    if (rangeMatch) {
      return {
        minAge: parseInt(rangeMatch[1], 10),
        maxAge: parseInt(rangeMatch[2], 10),
      };
    }

    // Match patterns like "18+", "25+"
    const plusMatch = targetAudience.match(/(\d+)\+/);
    if (plusMatch) {
      return {
        minAge: parseInt(plusMatch[1], 10),
        maxAge: undefined, // No upper limit
      };
    }

    // Match single age mentions like "18", "25" (applies ±5 years tolerance range for flexibility)
    const singleAgeMatch = targetAudience.match(/\b(\d{2})\b/);
    if (singleAgeMatch) {
      const age = parseInt(singleAgeMatch[1], 10);
      if (age >= 13 && age <= 65) {
        // Assume ±5 years range for single age mentions
        return {
          minAge: Math.max(13, age - 5),
          maxAge: Math.min(65, age + 5),
        };
      }
    }

    return null;
  }

  /**
   * Extract interests/keywords from target audience string
   */
  private extractInterests(targetAudience: string): string[] {
    const lowerAudience = targetAudience.toLowerCase();
    const commonInterests = [
      'tech', 'technology', 'fashion', 'music', 'sports', 'fitness', 'health',
      'food', 'travel', 'beauty', 'gaming', 'education', 'business', 'finance',
      'art', 'photography', 'writing', 'blogging', 'vlogging', 'entertainment',
      'lifestyle', 'parenting', 'cooking', 'diy', 'crafts', 'reading', 'books',
      'movies', 'tv', 'comedy', 'dance', 'yoga', 'meditation', 'wellness',
      'entrepreneurship', 'startup', 'coding', 'programming', 'design',
      'marketing', 'social media', 'influencer', 'celebrities', 'news',
      'politics', 'environment', 'sustainability', 'fitness enthusiast',
      'gym', 'workout', 'running', 'cycling', 'swimming', 'outdoor',
    ];

    const foundInterests: string[] = [];
    for (const interest of commonInterests) {
      if (lowerAudience.includes(interest)) {
        foundInterests.push(interest);
      }
    }

    return foundInterests;
  }

  /**
   * Check if user age matches task age requirements
   */
  private checkAgeRequirement(userAge: number | null, targetAudience: string): boolean {
    if (!userAge) {
      return false; // User hasn't provided age
    }

    const ageRange = this.parseAgeRange(targetAudience);
    if (!ageRange) {
      return true; // No age requirement specified
    }

    if (ageRange.minAge !== undefined && userAge < ageRange.minAge) {
      return false;
    }

    if (ageRange.maxAge !== undefined && userAge > ageRange.maxAge) {
      return false;
    }

    return true;
  }

  /**
   * Check if user interests match task requirements
   */
  private checkInterestsRequirement(
    userInterests: string[] | null,
    targetAudience: string,
  ): { matches: boolean; matchCount: number; requiredCount: number } {
    if (!userInterests || userInterests.length === 0) {
      return { matches: false, matchCount: 0, requiredCount: 1 };
    }

    const taskInterests = this.extractInterests(targetAudience);
    if (taskInterests.length === 0) {
      return { matches: true, matchCount: 0, requiredCount: 0 }; // No interest requirement
    }

    // Normalize interests for comparison
    const normalizeInterest = (interest: string) => interest.toLowerCase().trim();

    const normalizedUserInterests = userInterests.map(normalizeInterest);
    const normalizedTaskInterests = taskInterests.map(normalizeInterest);

    // Check for matches (fuzzy matching)
    let matchCount = 0;
    for (const taskInterest of normalizedTaskInterests) {
      // Exact match
      if (normalizedUserInterests.includes(taskInterest)) {
        matchCount++;
        continue;
      }

      // Partial match (e.g., "fitness" matches "fitness enthusiast")
      const hasPartialMatch = normalizedUserInterests.some(
        (userInterest) =>
          userInterest.includes(taskInterest) || taskInterest.includes(userInterest),
      );
      if (hasPartialMatch) {
        matchCount++;
      }
    }

    // Require at least 50% of task interests to match, or at least 1 match
    const requiredMatches = Math.max(1, Math.ceil(normalizedTaskInterests.length * 0.5));
    const matches = matchCount >= requiredMatches;

    return {
      matches,
      matchCount,
      requiredCount: requiredMatches,
    };
  }

  /**
   * Check if user has required social media platforms
   */
  private checkPlatformRequirement(
    userSocialHandles: any,
    taskPlatforms: any[],
  ): { matches: boolean; missingPlatforms: string[] } {
    if (!taskPlatforms || taskPlatforms.length === 0) {
      return { matches: true, missingPlatforms: [] };
    }

    if (!userSocialHandles || typeof userSocialHandles !== 'object') {
      return {
        matches: false,
        missingPlatforms: taskPlatforms.map((p: any) => p.name || p),
      };
    }

    const missingPlatforms: string[] = [];
    const platformMap: Record<string, string> = {
      instagram: 'instagram',
      twitter: 'twitter',
      x: 'twitter', // X is the new Twitter
      facebook: 'facebook',
      youtube: 'youtube',
      tiktok: 'tiktok',
      linkedin: 'linkedin',
      snapchat: 'snapchat',
    };

    for (const platform of taskPlatforms) {
      const platformName = (platform.name || platform).toLowerCase();
      const normalizedName = platformMap[platformName] || platformName;

      // Check if user has this platform
      const hasPlatform =
        userSocialHandles[normalizedName] ||
        userSocialHandles[platformName] ||
        userSocialHandles[platformName.replace(' ', '')];

      if (!hasPlatform) {
        missingPlatforms.push(platformName);
      }
    }

    return {
      matches: missingPlatforms.length === 0,
      missingPlatforms,
    };
  }

  /**
   * Normalize location strings for comparison
   */
  private normalizeLocation(location: string): string {
    return location
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '');
  }

  /**
   * Check if user location matches task location requirements
   */
  private checkLocationRequirement(
    userCity: string | null,
    userState: string | null,
    taskLocations: string[],
  ): { matches: boolean; reason?: string } {
    if (!taskLocations || taskLocations.length === 0) {
      return { matches: true }; // No location requirement
    }

    if (!userCity && !userState) {
      return {
        matches: false,
        reason: 'Location information not provided in profile',
      };
    }

    const normalizedUserCity = userCity ? this.normalizeLocation(userCity) : '';
    const normalizedUserState = userState ? this.normalizeLocation(userState) : '';

    // Check each task location
    for (const taskLocation of taskLocations) {
      const normalizedTaskLocation = this.normalizeLocation(taskLocation);

      // Exact match
      if (
        normalizedUserCity === normalizedTaskLocation ||
        normalizedUserState === normalizedTaskLocation
      ) {
        return { matches: true };
      }

      // Contains match (e.g., "Lagos" matches "Lagos State")
      if (
        normalizedUserCity.includes(normalizedTaskLocation) ||
        normalizedTaskLocation.includes(normalizedUserCity) ||
        normalizedUserState.includes(normalizedTaskLocation) ||
        normalizedTaskLocation.includes(normalizedUserState)
      ) {
        return { matches: true };
      }

      // Check for common location aliases
      const locationAliases: Record<string, string[]> = {
        lagos: ['lag', 'lagos state', 'lagos island', 'lagos mainland'],
        abuja: ['fct', 'federal capital territory'],
        'port harcourt': ['ph', 'port harcourt city', 'rivers'],
        kano: ['kano state'],
        ibadan: ['oyo'],
        benin: ['edo', 'benin city'],
        kaduna: ['kaduna state'],
      };

      const taskLocationLower = normalizedTaskLocation;
      for (const [key, aliases] of Object.entries(locationAliases)) {
        if (
          (normalizedTaskLocation === key || aliases.includes(normalizedTaskLocation)) &&
          (normalizedUserCity.includes(key) ||
            normalizedUserState.includes(key) ||
            aliases.some((alias) => normalizedUserCity.includes(alias)) ||
            aliases.some((alias) => normalizedUserState.includes(alias)))
        ) {
          return { matches: true };
        }
      }
    }

    return {
      matches: false,
      reason: `Location does not match. Required: ${taskLocations.join(', ')}`,
    };
  }

  /**
   * Check if user meets the requirements for a task
   * Comprehensive matching system for all task requirements
   * @param userId - User ID to check
   * @param task - Task to check requirements against
   * @param cachedUser - Optional pre-fetched user object to avoid redundant database queries
   */
  private async userMeetsTaskRequirements(
    userId: string,
    task: any,
    cachedUser?: any,
  ): Promise<{ meets: boolean; reason?: string; details?: any }> {
    // Use cached user if provided, otherwise fetch from database
    const user = cachedUser || await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return { meets: false, reason: 'Profile incomplete. Please complete your profile to apply for tasks.' };
    }

    const targeting = task.targeting as any;
    if (!targeting) {
      return { meets: true }; // No targeting requirements
    }

    const failureReasons: string[] = [];
    const details: any = {};

    // 1. Check location requirement
    if (targeting.locations && Array.isArray(targeting.locations) && targeting.locations.length > 0) {
      const locationCheck = this.checkLocationRequirement(
        user.profile.city,
        user.profile.state,
        targeting.locations,
      );
      details.location = locationCheck;
      if (!locationCheck.matches) {
        failureReasons.push(locationCheck.reason || 'Location does not match task requirements');
      }
    }

    // 2. Check age requirement from targetAudience
    if (targeting.targetAudience) {
      const ageCheck = this.checkAgeRequirement(user.profile.age, targeting.targetAudience);
      details.age = { matches: ageCheck, userAge: user.profile.age };
      if (!ageCheck) {
        const ageRange = this.parseAgeRange(targeting.targetAudience);
        if (ageRange) {
          failureReasons.push(
            `Age requirement not met. Task requires age ${ageRange.minAge}${ageRange.maxAge ? `-${ageRange.maxAge}` : '+'}, but your profile shows age ${user.profile.age || 'not specified'}`,
          );
        }
      }
    }

    // 3. Check interests requirement
    if (targeting.targetAudience) {
      const userInterests = user.profile.hobbiesInterests as string[] | null;
      const interestsCheck = this.checkInterestsRequirement(userInterests, targeting.targetAudience);
      details.interests = interestsCheck;
      if (!interestsCheck.matches) {
        failureReasons.push(
          `Interests do not match. Task requires interests related to: ${this.extractInterests(targeting.targetAudience).join(', ')}`,
        );
      }
    }

    // 4. Check platform requirement
    const taskPlatforms = task.platforms as any[];
    if (taskPlatforms && taskPlatforms.length > 0) {
      const platformCheck = this.checkPlatformRequirement(
        user.profile.socialMediaHandles,
        taskPlatforms,
      );
      details.platforms = platformCheck;
      if (!platformCheck.matches) {
        failureReasons.push(
          `Missing required social media platforms: ${platformCheck.missingPlatforms.join(', ')}. Please link these platforms in your profile.`,
        );
      }
    }

    // 5. Check language requirement (if specified)
    if (targeting.language) {
      // Language matching: Currently assumes English proficiency for all users
      // Future enhancement: Add language preferences to user profile for multi-language support
      const supportedLanguages = ['english', 'en'];
      const taskLanguage = targeting.language.toLowerCase().trim();
      const languageMatches = supportedLanguages.includes(taskLanguage) || taskLanguage === 'english';
      details.language = { matches: languageMatches, taskLanguage: targeting.language };
      if (!languageMatches) {
        failureReasons.push(`Language requirement not met. Task requires: ${targeting.language}`);
      }
    }

    const meets = failureReasons.length === 0;
    return {
      meets,
      reason: meets ? undefined : failureReasons.join('; '),
      details,
    };
  }

  /**
   * Filter tasks based on user profile requirements
   * Optimized to batch check requirements and cache user profile
   */
  private async filterTasksByUserRequirements(
    tasks: any[],
    userId?: string,
  ): Promise<any[]> {
    if (!userId || tasks.length === 0) {
      return tasks; // No user context or no tasks, return as-is
    }

    // Fetch user profile once for all tasks (optimization)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      // User has no profile, filter out all tasks with requirements
      return tasks.filter((task) => {
        const targeting = task.targeting as any;
        return !targeting || (!targeting.locations && !targeting.targetAudience);
      });
    }

    // Filter tasks based on requirements (user profile is cached and passed to avoid redundant queries)
    const filteredTasks: any[] = [];
    for (const task of tasks) {
      const requirementCheck = await this.userMeetsTaskRequirements(userId, task, user);
      if (requirementCheck.meets) {
        filteredTasks.push(task);
      }
    }

    return filteredTasks;
  }

  async getTasks(query: TaskQueryDto, userId?: string) {
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

    // Platform filtering is performed in-memory after fetching since Prisma's JSON filtering
    // doesn't efficiently support nested object queries in JSON arrays

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

    // Fetch tasks (fetch more if platform filter is needed for in-memory filtering)
    const fetchLimit = platform ? limit * 3 : limit;
    const [allTasks, totalCount] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: platform ? 0 : skip, // Fetch from start if filtering by platform
        take: fetchLimit,
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

    // Filter by platform if specified (platforms stored as array of strings, e.g. ["instagram"])
    let tasks = allTasks;
    if (platform) {
      tasks = allTasks.filter((task) => {
        const platforms = task.platforms as any[];
        if (!Array.isArray(platforms)) return false;
        return platforms.some((p) => (typeof p === 'string' ? p : p?.name) === platform);
      });
    }

    // Filter by user requirements (location, target audience, etc.)
    if (userId) {
      tasks = await this.filterTasksByUserRequirements(tasks, userId);
    }

    // Apply pagination after all filtering
    const startIndex = (page - 1) * limit;
    tasks = tasks.slice(startIndex, startIndex + limit);

    // Calculate total for pagination
    const total = platform || userId ? tasks.length : totalCount;

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

  async getTaskById(id: string, userId?: string) {
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

    // Check if user meets requirements (only for contributors viewing active tasks)
    if (userId && task.status === TaskStatus.ACTIVE) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user && user.userType === ('CONTRIBUTOR' as UserType)) {
        const requirementCheck = await this.userMeetsTaskRequirements(userId, task);
        if (!requirementCheck.meets) {
          throw new ForbiddenException(
            requirementCheck.reason || 'You do not meet the requirements to view this task',
          );
        }
      }
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
    if (updateTaskDto.platform) updateData.platforms = [updateTaskDto.platform];
    if (updateTaskDto.taskType) updateData.taskType = updateTaskDto.taskType;
    if (updateTaskDto.category) updateData.category = updateTaskDto.category;
    if (updateTaskDto.contentType) updateData.contentType = updateTaskDto.contentType;
    if (updateTaskDto.resourceLink !== undefined) {
      const category = updateTaskDto.category ?? (task as any).category;
      updateData.resourceLink = category === 'MAKE_POST' ? null : updateTaskDto.resourceLink;
    }
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

    // Check if user meets task requirements
    const requirementCheck = await this.userMeetsTaskRequirements(userId, task);
    if (!requirementCheck.meets) {
      throw new BadRequestException(
        requirementCheck.reason || 'You do not meet the requirements for this task',
      );
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

    // Check payment status
    const taskData = task as any;
    const paymentStatus = taskData.paymentStatus || 'PENDING';

    if (paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Payment required before publishing. Call POST /tasks/:id/initiate-payment to get the payment URL, complete payment, then publish.',
      );
    }

    // Validate required fields for publishing
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

    // Validate platform (stored as array of strings, e.g. ["instagram"])
    if (!Array.isArray(task.platforms) || task.platforms.length === 0) {
      throw new BadRequestException('Platform is required');
    }
    const platformName = (task.platforms as any[])[0];
    if (!platformName || typeof platformName !== 'string') {
      throw new BadRequestException('Valid platform is required');
    }

    // Validate budget
    if (!taskData.budget || Number(taskData.budget) <= 0) {
      throw new BadRequestException('Valid budget is required');
    }

    // Generate AI brief
    let brief = '';
    let llmContext = '';

    try {
      // Platform stored as array of strings, e.g. ["instagram"]
      const platformNames = (task.platforms as any[])
        .map((p) => (typeof p === 'string' ? p : p?.name))
        .filter(Boolean);

      const aiResult = await this.aiService.generateTaskBrief({
        title: task.title,
        description: task.description || '',
        platforms: platformNames,
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

    // Format the summary (platform stored as ["instagram"], we expose platform + resourceLink)
    const platformsArr = Array.isArray(task.platforms) ? task.platforms : [];
    const platform = platformsArr[0] && (typeof platformsArr[0] === 'string' ? platformsArr[0] : (platformsArr[0] as any)?.name);
    const summary = {
      id: task.id,
      status: task.status,
      taskType: taskData.taskType,
      category: taskData.category,
      title: task.title,
      description: task.description,
      platform: platform || null,
      platforms: platformsArr, // kept for backward compatibility
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

  /**
   * Initiate payment for a draft task. Returns payment URL.
   * Must be called before publishing. After payment is completed, call publish.
   */
  async initiatePayment(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only initiate payment for your own tasks');
    }

    const taskData = task as any;
    if (taskData.paymentStatus === 'PAID') {
      throw new BadRequestException('Task is already paid. You can publish directly.');
    }

    if (task.status !== TaskStatus.DRAFT) {
      throw new BadRequestException('Only draft tasks can be paid. Task must be in draft status.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const budgetAmount = Number(taskData.budget) || 0;
    const platformFeePercentage = Number(taskData.platformFeePercentage) || 5;
    const platformFee = (budgetAmount * platformFeePercentage) / 100;
    const totalAmount = budgetAmount + platformFee;

    // Always use a fresh reference for Paystack (must be unique per transaction)
    const paymentReference = `TASK_${Date.now()}_${taskId.substring(0, 8)}`;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const callbackUrl = `${frontendUrl}/tasks/payment/callback`;

    const paymentResponse = await this.paystackService.initializePayment({
      email: user.email,
      amount: totalAmount,
      reference: paymentReference,
      callback_url: callbackUrl,
      metadata: {
        taskId,
        userId,
        type: 'TASK_PAYMENT',
      },
    });

    const paymentUrl = paymentResponse.data.authorization_url;

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        paymentReference,
        paymentAuthorizationUrl: paymentUrl,
        paymentStatus: 'PENDING' as any,
      } as any,
    });

    // amountInKobo: Paystack SDK expects amount in kobo (Naira × 100)
    const amountInKobo = Math.round(totalAmount * 100);

    return {
      message: 'Payment initiated. Use these values with Paystack SDK, then call POST /tasks/payment/verify with the reference when payment completes.',
      data: {
        reference: paymentReference,
        amountInKobo,
        amount: totalAmount,
        email: user.email,
        authorizationUrl: paymentUrl,
        breakdown: {
          budget: budgetAmount,
          platformFee,
          total: totalAmount,
        },
      },
    };
  }

  async verifyPayment(reference: string) {
    try {
      const verification = await this.paystackService.verifyPayment(reference);

      if (verification.data.status === 'success') {
        // Find task by payment reference
        const task = await this.prisma.task.findUnique({
          where: { paymentReference: reference } as any,
        });

        if (!task) {
          throw new NotFoundException('Task not found for this payment reference');
        }

        // Update task payment status
        const updatedTask = await this.prisma.task.update({
          where: { id: task.id },
          data: {
            paymentStatus: 'PAID' as any,
            paymentVerifiedAt: new Date(),
          } as any,
        });

        return {
          message: 'Payment verified successfully',
          data: {
            task: updatedTask,
            payment: {
              reference: verification.data.reference,
              amount: verification.data.amount / 100, // Convert from kobo
              status: verification.data.status,
              paidAt: verification.data.paid_at,
            },
          },
        };
      } else {
        // Update task payment status to failed
        const task = await this.prisma.task.findUnique({
          where: { paymentReference: reference } as any,
        });

        if (task) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              paymentStatus: 'FAILED' as any,
            } as any,
          });
        }

        throw new BadRequestException('Payment verification failed');
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Payment verification error: ${error.message}`);
    }
  }

  async handlePaymentWebhook(payload: any) {
    try {
      const event = payload.event;
      const data = payload.data;

      if (event === 'charge.success' || event === 'transaction.success') {
        const reference = data.reference;

        // Verify payment with Paystack
        const verification = await this.paystackService.verifyPayment(reference);

        if (verification.data.status === 'success') {
          // Find and update task
          const task = await this.prisma.task.findUnique({
            where: { paymentReference: reference } as any,
          });

          if (task) {
            await this.prisma.task.update({
              where: { id: task.id },
              data: {
                paymentStatus: 'PAID' as any,
                paymentVerifiedAt: new Date(),
              } as any,
            });
          }
        }
      } else if (event === 'charge.failed' || event === 'transaction.failed') {
        const reference = data.reference;

        // Update task payment status to failed
        const task = await this.prisma.task.findUnique({
          where: { paymentReference: reference } as any,
        });

        if (task) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              paymentStatus: 'FAILED' as any,
            } as any,
          });
        }
      }

      return { success: true };
    } catch (error) {
      throw new BadRequestException(`Webhook processing error: ${error.message}`);
    }
  }
}

