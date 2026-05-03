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

const DIRECT_TASK_PAYMENT_TYPE = 'TASK_DIRECT_PAYMENT';

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
        categories,
        taskTypes,
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

    // Generate AI brief at creation so users can preview before publishing
    let brief = '';
    let llmContext = '';
    try {
      const aiResult = await this.aiService.generateTaskBrief({
        title: createTaskDto.title,
        description: createTaskDto.description || '',
        platforms: [createTaskDto.platform],
        category: createTaskDto.category,
        contentType: createTaskDto.contentType,
        targeting: (createTaskDto.targeting || {}) as any,
        commentsInstructions: createTaskDto.commentsInstructions || '',
        hashtags: createTaskDto.hashtags || [],
        buzzwords: createTaskDto.buzzwords || [],
      });
      brief = aiResult.brief;
      llmContext = aiResult.llmContext;
    } catch (error) {
      this.logger.error(`Failed to generate AI brief: ${error.message}`);
      brief = createTaskDto.description || createTaskDto.title;
      llmContext = `Task: ${createTaskDto.title}\n${createTaskDto.description || ''}`;
    }

    // Draft only — payment is checked in publishTask(), not here.
    const task = await this.prisma.task.create({
      data: {
        creatorId: userId,
        taskType: createTaskDto.taskType,
        category: createTaskDto.category,
        title: createTaskDto.title,
        description: createTaskDto.description,
        platforms: [createTaskDto.platform],
        goals: [],
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
        budgetPerTask: createTaskDto.budget,
        totalBudget: createTaskDto.budget,
        status,
        aiGeneratedBrief: brief,
        llmContextFile: llmContext,
        paymentStatus: 'PENDING',
      },
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
      category,
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

    if (category) {
      where.category = category;
    }

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
              reputationScore: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  city: true,
                  state: true,
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

  /**
   * Marketplace feed: ACTIVE tasks shaped for listing cards (public).
   */
  async getMarketplaceList(query: TaskQueryDto, userId?: string) {
    const result = await this.getTasks(query, userId);
    const tasks = (result.data.tasks as any[]).map((t) => this.toMarketplaceCard(t));
    return {
      message: 'Marketplace tasks retrieved successfully',
      data: {
        tasks,
        pagination: result.data.pagination,
      },
    };
  }

  /**
   * Marketplace job detail page: one ACTIVE task + client block + apply eligibility.
   */
  async getMarketplaceDetail(id: string, userId?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            reputationScore: true,
            createdAt: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                city: true,
                state: true,
              },
            },
          },
        },
        _count: { select: { applications: true, submissions: true } },
      },
    });

    if (!task || task.status !== TaskStatus.ACTIVE) {
      throw new NotFoundException('Task not found');
    }

    const eligibility = await this.buildMarketplaceEligibility(userId, task);

    return {
      message: 'Task details retrieved successfully',
      data: {
        task: this.toMarketplaceDetail(task),
        eligibility,
      },
    };
  }

  /**
   * Similar jobs (same category), excluding the current task.
   */
  async getSimilarTasks(taskId: string, limit = 6) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const rows = await this.prisma.task.findMany({
      where: {
        id: { not: taskId },
        status: TaskStatus.ACTIVE,
        category: task.category,
      },
      take: Math.min(limit, 20),
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            reputationScore: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                city: true,
                state: true,
              },
            },
          },
        },
        _count: { select: { applications: true, submissions: true } },
      },
    });

    return {
      message: 'Similar tasks retrieved successfully',
      data: {
        tasks: rows.map((t) => this.toMarketplaceCard(t)),
      },
    };
  }

  private async buildMarketplaceEligibility(
    userId: string | undefined,
    task: any,
  ): Promise<{
    canApply: boolean | null;
    requiresAuth?: boolean;
    reason?: string;
  }> {
    if (!userId) {
      return { canApply: null, requiresAuth: true };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return { canApply: null, requiresAuth: true };
    }

    if (user.userType !== ('CONTRIBUTOR' as UserType)) {
      return { canApply: false, reason: 'Only contributor accounts can apply for tasks' };
    }

    const check = await this.userMeetsTaskRequirements(userId, task, user);
    if (!check.meets) {
      return { canApply: false, reason: check.reason };
    }

    const existing = await this.prisma.taskApplication.findFirst({
      where: { taskId: task.id, taskerId: userId },
    });
    if (existing) {
      return { canApply: false, reason: 'You have already applied to this task' };
    }

    return { canApply: true };
  }

  private toMarketplaceCard(task: any) {
    const budget = Number(task.budget);
    return {
      id: task.id,
      title: task.title,
      descriptionPreview: this.previewText(task.description, 200),
      postedAt: task.createdAt,
      postedLabel: this.formatPostedLabel(task.createdAt),
      category: task.category,
      categoryLabel: this.categoryLabel(task.category),
      taskType: task.taskType,
      skills: this.extractSkills(task),
      budget,
      budgetLabel: this.formatBudgetLabel(task),
      scheduleType: task.scheduleType,
      paymentVerified: (task as any).paymentStatus === 'PAID',
      platforms: task.platforms,
      proposalCount: task._count?.applications ?? 0,
      client: this.toMarketplaceClient(task.creator),
    };
  }

  private toMarketplaceDetail(task: any) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      categoryLabel: this.categoryLabel(task.category),
      taskType: task.taskType,
      contentType: task.contentType,
      scheduleType: task.scheduleType,
      scheduleStart: task.scheduleStart,
      scheduleEnd: task.scheduleEnd,
      budget: Number(task.budget),
      budgetLabel: this.formatBudgetLabel(task),
      paymentVerified: (task as any).paymentStatus === 'PAID',
      platforms: task.platforms,
      hashtags: task.hashtags,
      buzzwords: task.buzzwords,
      skills: this.extractSkills(task),
      targeting: task.targeting,
      commentsInstructions: task.commentsInstructions,
      aiGeneratedBrief: task.aiGeneratedBrief,
      contributorSummary: task.contributorSummary,
      resourceLink: task.resourceLink,
      createdAt: task.createdAt,
      postedLabel: this.formatPostedLabel(task.createdAt),
      proposalCount: task._count?.applications ?? 0,
      client: this.toMarketplaceClient(task.creator),
    };
  }

  private toMarketplaceClient(creator: any) {
    if (!creator) {
      return null;
    }
    const profile = creator.profile;
    const displayName = profile?.firstName || profile?.lastName
      ? [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
      : (creator.email ? String(creator.email).split('@')[0] : 'Client');
    return {
      id: creator.id,
      displayName,
      rating: this.reputationToStars(creator.reputationScore ?? 75),
      reviewCount: 0,
      location:
        profile?.city || profile?.state
          ? [profile.city, profile.state].filter(Boolean).join(', ')
          : null,
      memberSince: creator.createdAt,
    };
  }

  private reputationToStars(score: number): number {
    const s = Math.max(0, Math.min(100, score));
    return Math.round((s / 100) * 50) / 10;
  }

  private previewText(text: string | null | undefined, max: number): string {
    if (!text) return '';
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  private formatPostedLabel(date: Date): string {
    const d = new Date(date);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'Posted just now';
    if (sec < 3600) return `Posted ${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `Posted ${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `Posted ${Math.floor(sec / 86400)}d ago`;
    return `Posted ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  private categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      MAKE_POST: 'Create post',
      COMMENT_POST: 'Comments',
      LIKE_SHARE_SAVE_REPOST: 'Engagement',
      FOLLOW_ACCOUNT: 'Follow account',
    };
    return labels[category] || category;
  }

  private extractSkills(task: any): string[] {
    const tags: string[] = [];
    if (Array.isArray(task.hashtags)) {
      tags.push(...task.hashtags.map((x: any) => String(x)));
    }
    if (Array.isArray(task.buzzwords)) {
      tags.push(...task.buzzwords.map((x: any) => String(x)));
    }
    return [...new Set(tags)].filter(Boolean).slice(0, 12);
  }

  private formatBudgetLabel(task: any): string {
    const n = Number(task.budget);
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(n);
    if (task.scheduleType === 'FIXED') {
      return `${formatted} · fixed budget`;
    }
    return `${formatted} · flexible schedule`;
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
    if (updateTaskDto.category) updateData.category = updateTaskDto.category;
    if (updateTaskDto.taskType) updateData.taskType = updateTaskDto.taskType;
    if (updateTaskDto.contentType) updateData.contentType = updateTaskDto.contentType;
    if (updateTaskDto.resourceLink !== undefined) {
      const taskCategoryForResource = updateTaskDto.category ?? (task as any).category;
      updateData.resourceLink = taskCategoryForResource === 'MAKE_POST' ? null : updateTaskDto.resourceLink;
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
      // Update existing draft and regenerate AI brief with new data
      const updated = await this.updateTask(userId, taskId, {
        ...createTaskDto,
        status: TaskStatus.DRAFT,
      } as UpdateTaskDto);

      // Regenerate AI brief with updated task data for preview
      try {
        const aiResult = await this.aiService.generateTaskBrief({
          title: createTaskDto.title,
          description: createTaskDto.description || '',
          platforms: [createTaskDto.platform],
          category: createTaskDto.category,
          contentType: createTaskDto.contentType,
          targeting: (createTaskDto.targeting || {}) as any,
          commentsInstructions: createTaskDto.commentsInstructions || '',
          hashtags: createTaskDto.hashtags || [],
          buzzwords: createTaskDto.buzzwords || [],
        });
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            aiGeneratedBrief: aiResult.brief,
            llmContextFile: aiResult.llmContext,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to regenerate AI brief on save: ${error.message}`);
      }

      const finalTask = await this.prisma.task.findUnique({
        where: { id: taskId },
      });
      return {
        message: 'Draft updated successfully',
        data: finalTask || updated.data,
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

    // Payment gate: only publishing requires PAID (create/update draft does not).
    const taskData = task as any;
    const paymentStatus = taskData.paymentStatus || 'PENDING';

    if (paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Payment required before publishing. Use initiate-payment, complete payment, then call publish again.',
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

    // Use existing AI brief (generated at creation). Only update status.
    const publishedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.ACTIVE,
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
      aiGeneratedBrief: (task as any).aiGeneratedBrief || null,
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

  async initiateDirectPayment(userId: string, taskId: string) {
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

    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only initiate payment for your own tasks');
    }

    if (user.userType !== UserType.CREATOR) {
      throw new ForbiddenException('Only creators can pay for tasks');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email first');
    }

    const taskData = task as any;
    if (taskData.paymentStatus === 'PAID') {
      throw new BadRequestException('Task is already paid. You can publish directly.');
    }

    if (task.status !== TaskStatus.DRAFT) {
      throw new BadRequestException('Only draft tasks can be paid. Task must be in draft status.');
    }

    const breakdown = this.getTaskPaymentBreakdown(task);
    const paymentReference = `TASKDIRECT-${Date.now()}-${taskId.substring(0, 8)}`;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const callbackUrl = `${frontendUrl}/tasks/payment/callback`;

    const paymentResponse = await this.paystackService.initializePayment({
      email: user.email,
      amount: breakdown.total,
      reference: paymentReference,
      callback_url: callbackUrl,
      metadata: {
        taskId,
        userId,
        type: DIRECT_TASK_PAYMENT_TYPE,
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

    return {
      message:
        'Direct payment initiated. Complete Paystack checkout, then call POST /tasks/direct-payment/verify with the reference.',
      data: {
        reference: paymentReference,
        amountInKobo: this.toKobo(breakdown.total),
        amount: breakdown.total,
        email: user.email,
        authorizationUrl: paymentUrl,
        breakdown,
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

  async verifyDirectPayment(userId: string, reference: string) {
    if (!reference?.trim()) {
      throw new BadRequestException('Payment reference is required');
    }

    try {
      const task = await this.prisma.task.findUnique({
        where: { paymentReference: reference } as any,
      });

      if (!task) {
        throw new NotFoundException('Task not found for this payment reference');
      }

      if (task.creatorId !== userId) {
        throw new ForbiddenException('You can only verify payment for your own tasks');
      }

      const taskData = task as any;
      if (taskData.paymentStatus === 'PAID') {
        return {
          message: 'Payment already verified',
          data: {
            task,
            payment: {
              reference,
              status: 'success',
            },
          },
        };
      }

      if (task.status !== TaskStatus.DRAFT) {
        throw new BadRequestException('Only draft tasks can be verified for direct payment');
      }

      const verification = await this.paystackService.verifyPayment(reference);
      const payment = verification.data;

      if (payment.status !== 'success') {
        await this.markPaymentFailed(reference);
        throw new BadRequestException('Payment verification failed');
      }

      const breakdown = this.getTaskPaymentBreakdown(task);
      const metadata = this.normalizePaystackMetadata(payment.metadata);
      const expectedAmountInKobo = this.toKobo(breakdown.total);

      if (payment.reference !== reference) {
        throw new BadRequestException('Payment reference mismatch');
      }

      if (payment.amount !== expectedAmountInKobo) {
        throw new BadRequestException('Payment amount mismatch');
      }

      if (payment.currency !== 'NGN') {
        throw new BadRequestException('Payment currency mismatch');
      }

      if (
        metadata.taskId !== task.id ||
        metadata.userId !== userId ||
        metadata.type !== DIRECT_TASK_PAYMENT_TYPE
      ) {
        throw new BadRequestException('Payment metadata mismatch');
      }

      const updatedTask = await this.prisma.task.update({
        where: { id: task.id },
        data: {
          paymentStatus: 'PAID' as any,
          paymentVerifiedAt: new Date(),
        } as any,
      });

      return {
        message: 'Direct payment verified successfully',
        data: {
          task: updatedTask,
          payment: {
            reference: payment.reference,
            amount: payment.amount / 100,
            status: payment.status,
            paidAt: payment.paid_at,
          },
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(`Payment verification error: ${error.message}`);
    }
  }

  async handlePaymentWebhook(payload: any, signature?: string, rawBody?: Buffer | string) {
    try {
      if (!this.paystackService.verifyWebhookSignature(signature, rawBody)) {
        throw new BadRequestException('Invalid Paystack webhook signature');
      }

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
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Webhook processing error: ${error.message}`);
    }
  }

  private getTaskPaymentBreakdown(task: any) {
    const budget = Number(task.budget) || 0;
    const platformFeePercentage = Number(task.platformFeePercentage) || 5;
    const platformFee = (budget * platformFeePercentage) / 100;
    const total = budget + platformFee;

    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Task payment amount is invalid');
    }

    return {
      budget,
      platformFee,
      total,
    };
  }

  private toKobo(amount: number): number {
    return Math.round(amount * 100);
  }

  private normalizePaystackMetadata(metadata: unknown): Record<string, any> {
    if (!metadata) {
      return {};
    }

    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }

    if (typeof metadata === 'object') {
      return metadata as Record<string, any>;
    }

    return {};
  }

  private async markPaymentFailed(reference: string) {
    const task = await this.prisma.task.findUnique({
      where: { paymentReference: reference } as any,
    });

    if (!task) {
      return;
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        paymentStatus: 'FAILED' as any,
      } as any,
    });
  }
}
