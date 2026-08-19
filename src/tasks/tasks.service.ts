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
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from '../common/services/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApplyTaskDto } from './dto/apply-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import {
  TaskStatus,
  ApplicationStatus,
  UserType,
  TransactionCategory,
  TransactionStatus,
  DisputeStatus,
} from '@prisma/client';
import {
  contributorNetPayoutAmount,
  contributorPayoutBreakdown,
  resolvePayoutPool,
  parsePositiveInt,
  resolveContributorSlotsForPersistence,
  resolveRequiredContributorSlots,
} from '../common/utils/task-payout.util';
import { parsePaystackMetadata } from '../common/utils/paystack-metadata.util';
import {
  estimateTaskPricing as computeTaskPricingEstimate,
  getCategoryAmount,
  getContentTypeAmount,
  getPostRate,
  isBudgetAlignedWithPricing,
  loadTaskPricingConfig,
  TaskPricingConfig,
} from '../common/utils/task-pricing.util';
import {
  matchesTargetGender,
  TARGET_GENDERS,
  TARGET_GENDER_LABELS,
} from '../common/constants/gender';
import { TASK_CATEGORY_LABELS } from '../common/constants/task-categories';
import { EstimateTaskPricingDto } from './dto/estimate-task-pricing.dto';
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
  private readonly taskPricing: TaskPricingConfig;

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private reputationService: ReputationService,
    private paystackService: PaystackService,
    private configService: ConfigService,
    private walletService: WalletService,
    private emailService: EmailService,
  ) {
    this.taskPricing = loadTaskPricingConfig((key) =>
      this.configService.get<string>(key),
    );
  }

  /**
   * Returns available task types and categories for task creation.
   * Used when the tasker chooses what type of task they want to create.
   */
  getTaskTypes() {
    const categories = [
      {
        value: TaskCategory.LIKE_SHARE_SAVE_REPOST,
        label: TASK_CATEGORY_LABELS.LIKE_SHARE_SAVE_REPOST,
        description: 'Get likes, reposts, shares, or saves on your content',
        amount: getCategoryAmount(this.taskPricing, TaskCategory.LIKE_SHARE_SAVE_REPOST),
      },
      {
        value: TaskCategory.COMMENT_POST,
        label: TASK_CATEGORY_LABELS.COMMENT_POST,
        description: 'Get comments on your post',
        amount: getCategoryAmount(this.taskPricing, TaskCategory.COMMENT_POST),
      },
      {
        value: TaskCategory.MAKE_POST,
        label: TASK_CATEGORY_LABELS.MAKE_POST,
        description: 'Have contributors create and publish a post',
        amount: getCategoryAmount(this.taskPricing, TaskCategory.MAKE_POST),
      },
      {
        value: TaskCategory.FOLLOW_ACCOUNT,
        label: TASK_CATEGORY_LABELS.FOLLOW_ACCOUNT,
        description: 'Get contributors to follow your account',
        amount: getCategoryAmount(this.taskPricing, TaskCategory.FOLLOW_ACCOUNT),
      },
    ];

    const taskTypes = [
      { value: TaskType.SINGLE, label: 'One-time', description: 'Single engagement per contributor' },
      { value: TaskType.MULTI, label: 'Multiple', description: 'Multiple engagements per contributor' },
    ];

    // `amount` is the locked per-contributor price of a post of this type — the
    // number to render. It used to be the premium, which read as "text posts
    // cost 0"; the premium is now `premium`, kept only for the breakdown, and
    // `postTotal` stays as an alias of `amount` for clients already on it.
    const contentTypes = [ContentType.VIDEO, ContentType.TEXT, ContentType.IMAGE].map(
      (value) => {
        const amount = getPostRate(this.taskPricing, value);
        return {
          value,
          label: value.charAt(0) + value.slice(1).toLowerCase(),
          amount,
          postTotal: amount,
          premium: getContentTypeAmount(this.taskPricing, value),
        };
      },
    );

    // Optional audience filter — ALL is what an omitted targeting.gender means.
    const targetGenders = TARGET_GENDERS.map((value) => ({
      value,
      label: TARGET_GENDER_LABELS[value],
    }));

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
        targetGenders,
        scheduleTypes,
        pricing: {
          formula:
            'For MAKE_POST, unitRate = contentType.amount — it is already the full locked ' +
            'per-contributor rate, so do NOT add category.amount to it. For every other ' +
            'category, unitRate = category.amount and content type is ignored. ' +
            'payoutPool = unitRate × contributorSlots, and contributors receive that in full. ' +
            'totalBudget = payoutPool + platform fee, charged to the creator at task creation.',
          platformFeePercentage: this.taskPricing.platformFeePercentage,
          platformFeePaidBy: 'CREATOR',
          contributorDeduction: 0,
          contentTypePricedCategories: ['MAKE_POST'],
          currency: 'NGN',
        },
      },
    };
  }

  estimateTaskPricing(dto: EstimateTaskPricingDto) {
    const estimate = computeTaskPricingEstimate(this.taskPricing, {
      category: dto.category,
      contentType: dto.contentType,
      contributorCount: dto.contributorCount,
      budget: dto.budget,
    });

    return {
      message: 'Task pricing estimated successfully',
      data: estimate,
    };
  }

  private resolveCreateTaskPricing(createTaskDto: CreateTaskDto) {
    const estimate = computeTaskPricingEstimate(this.taskPricing, {
      category: createTaskDto.category,
      contentType: createTaskDto.contentType,
      contributorCount: createTaskDto.contributorCount,
      budget: createTaskDto.budget,
    });

    // `budget` is optional: the server already knows the rate, the slot count
    // and the fee, so it derives the figure itself. When a client does send
    // one it is still checked — it is what the creator gets charged, so a
    // mismatch must fail loudly rather than be silently overwritten.
    if (
      createTaskDto.budget !== undefined &&
      !isBudgetAlignedWithPricing(createTaskDto.budget, estimate)
    ) {
      throw new BadRequestException(
        `Budget must be ${estimate.totalBudget} NGN — ${estimate.unitRate} per contributor × ` +
          `${estimate.contributorSlots} contributors = ${estimate.payoutPool} paid out in full, plus ` +
          `${estimate.platformFeePercentage}% platform fee (${estimate.platformFee}). ` +
          `Breakdown: category ${estimate.categoryAmount} + content type ${estimate.contentTypeAmount}. ` +
          `Omit budget entirely to have it calculated for you.`,
      );
    }

    return estimate;
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

    // Content moderation — check for explicit content and conflicting instructions
    const moderation = await this.aiService.moderateTaskContent({
      category: createTaskDto.category,
      title: createTaskDto.title,
      description: createTaskDto.description,
      commentsInstructions: createTaskDto.commentsInstructions,
      hashtags: createTaskDto.hashtags,
      buzzwords: createTaskDto.buzzwords,
    });
    if (!moderation.approved) {
      throw new BadRequestException({
        message: 'Task content did not pass our content policy check.',
        reason: moderation.reason,
        violations: moderation.violations,
      });
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
    } catch (error: any) {
      this.logger.error(`Failed to generate AI brief: ${error.message}`);
      brief = createTaskDto.description || createTaskDto.title;
      llmContext = `Task: ${createTaskDto.title}\n${createTaskDto.description || ''}`;
    }

    if (!parsePositiveInt(createTaskDto.contributorCount)) {
      throw new BadRequestException(
        'contributorCount is required — it defines how many contributors the budget covers.',
      );
    }

    const pricing = this.resolveCreateTaskPricing(createTaskDto);
    const contributorSlots = pricing.contributorSlots;
    const grossPerContributor = pricing.grossPerContributor;

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
        // Kept for every category, MAKE_POST included: a creator's reference
        // link (the sound to use, the post to riff on) is an INPUT to the work.
        // It is not the contributor's submission link, which is a separate
        // field captured as evidence at review time.
        resourceLink: createTaskDto.resourceLink ?? null,
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
        // The server's own figure, not the submitted one. They agree to within
        // the ±1 rounding tolerance when a client sends a budget, and this is
        // the amount actually charged, so the exact value has to be ours.
        budget: pricing.totalBudget,
        // The creator funds pool + fee; contributors are paid from the pool
        // alone, so it is stored rather than re-derived from the funded total.
        payoutPool: pricing.payoutPool,
        platformFeePercentage: pricing.platformFeePercentage,
        contributorSlots,
        budgetPerTask: grossPerContributor,
        totalBudget: pricing.totalBudget,
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

    // 5. Check gender requirement (if the creator targeted one)
    if (targeting.gender && targeting.gender !== 'ALL') {
      const genderMatches = matchesTargetGender(user.profile.gender, targeting.gender);
      details.gender = {
        matches: genderMatches,
        taskGender: targeting.gender,
        userGender: user.profile.gender,
      };
      if (!genderMatches) {
        failureReasons.push(
          user.profile.gender
            ? `This task is open to ${TARGET_GENDER_LABELS[targeting.gender] ?? targeting.gender} contributors only.`
            : 'This task targets a specific gender. Add your gender to your profile to see if you qualify.',
        );
      }
    }

    // 6. Check language requirement (if specified)
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
        return (
          !targeting ||
          (!targeting.locations &&
            !targeting.targetAudience &&
            matchesTargetGender(null, targeting.gender))
        );
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

  /**
   * Contributor-facing task payload: no payment fields, no creator/creatorId, no submissions,
   * no assigned-application ids. Gross campaign budget and required headcount hidden.
   * `payoutPerContributor` = fixed net pay for one completed contribution (budget ÷ required contributors).
   */
  private sanitizeTaskForContributorView(rawTask: any): any {
    if (!rawTask) return rawTask;
    const payout = contributorPayoutBreakdown({
      budget: rawTask.budget,
      payoutPool: rawTask.payoutPool,
      contributorSlots: rawTask.contributorSlots,
      taskType: rawTask.taskType,
      audiencePreferences: rawTask.audiencePreferences,
      targeting: rawTask.targeting,
      platformFeePercentage: rawTask.platformFeePercentage,
    });
    const {
      creator: _c,
      creatorId: _cid,
      submissions: _subs,
      applications: _apps,
      paymentStatus: _ps,
      paymentReference: _pr,
      paymentAuthorizationUrl: _pa,
      paymentVerifiedAt: _pv,
      budget: _b,
      payoutPool: _pool,
      totalBudget: _tb,
      platformFeePercentage: _pf,
      budgetPerTask: _legacyBpt,
      contributorSlots: _slots,
      _count: rawCount,
      ...rest
    } = rawTask;

    const _count =
      rawCount && typeof rawCount === 'object'
        ? { applications: (rawCount as any).applications }
        : undefined;

    const allottedPayout = payout.netPerContributor.toFixed(2);

    return {
      ...rest,
      ...(_count !== undefined ? { _count } : {}),
      payoutPerContributor: allottedPayout,
      budgetPerTask: allottedPayout,
    };
  }

  private async queryPublishedTasksPage(
    query: TaskQueryDto,
    includeCreator: boolean,
  ): Promise<{
    tasks: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 10,
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
      status: TaskStatus.ACTIVE,
    };

    if (category) {
      where.category = category;
    }

    if (goal) {
      where.OR = [
        { category: goal },
        { goals: { has: goal } },
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
    const sortFieldMap: Record<string, string> = {
      budgetPerTask: 'budget',
      createdAt: 'createdAt',
      scheduleStart: 'scheduleStart',
    };
    const mappedSortBy = sortFieldMap[sortBy] || sortBy;
    orderBy[mappedSortBy] = sortOrder;

    const fetchLimit = platform ? limit * 3 : limit;
    const loadContributorShareContext = !includeCreator;

    const [allTasks, totalCount] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: platform ? 0 : skip,
        take: fetchLimit,
        orderBy,
        include: {
          ...(includeCreator
            ? {
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
              }
            : {}),
          ...(loadContributorShareContext
            ? {
                applications: {
                  where: {
                    status: {
                      in: [
                        ApplicationStatus.APPROVED,
                        ApplicationStatus.COMPLETED,
                      ],
                    },
                  },
                  select: { id: true },
                },
              }
            : {}),
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

    let tasks = allTasks;
    if (platform) {
      tasks = allTasks.filter((task) => {
        const platforms = task.platforms as any[];
        if (!Array.isArray(platforms)) return false;
        return platforms.some((p) => (typeof p === 'string' ? p : p?.name) === platform);
      });
    }

    const total = platform ? tasks.length : totalCount;

    const startIndex = (page - 1) * limit;
    tasks = tasks.slice(startIndex, startIndex + limit);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getTasks(query: TaskQueryDto, viewer?: { userType: UserType }) {
    const includeCreator = viewer?.userType !== ('CONTRIBUTOR' as UserType);
    const { tasks, pagination } = await this.queryPublishedTasksPage(query, includeCreator);

    const list = includeCreator
      ? tasks
      : tasks.map((t) => this.sanitizeTaskForContributorView(t));

    return {
      message: 'Tasks retrieved successfully',
      data: {
        tasks: list,
        pagination,
      },
    };
  }

  async getTaskById(id: string, viewer?: { id: string; userType: UserType }) {
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

    const userId = viewer?.id;

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

    const contributorBrowsingOthersTask =
      viewer &&
      viewer.userType === ('CONTRIBUTOR' as UserType) &&
      task.creatorId !== viewer.id;

    const data = contributorBrowsingOthersTask
      ? this.sanitizeTaskForContributorView(task)
      : task;

    return {
      message: 'Task retrieved successfully',
      data,
    };
  }

  /**
   * Marketplace feed: ACTIVE tasks shaped for listing cards (public).
   */
  async getMarketplaceList(query: TaskQueryDto) {
    const { tasks, pagination } = await this.queryPublishedTasksPage(query, false);
    return {
      message: 'Marketplace tasks retrieved successfully',
      data: {
        tasks: tasks.map((t) => this.toMarketplaceCard(t)),
        pagination,
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
        applications: {
          where: {
            status: {
              in: [ApplicationStatus.APPROVED, ApplicationStatus.COMPLETED],
            },
          },
          select: { id: true },
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
        applications: {
          where: {
            status: {
              in: [ApplicationStatus.APPROVED, ApplicationStatus.COMPLETED],
            },
          },
          select: { id: true },
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
    const net = contributorNetPayoutAmount(task);
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
      budgetPerTask: net.toFixed(2),
      budgetLabel: this.formatBudgetLabelFromAmount(net, task.scheduleType),
      scheduleType: task.scheduleType,
      platforms: task.platforms,
      resourceLink: task.resourceLink,
      proposalCount: task._count?.applications ?? 0,
    };
  }

  private toMarketplaceDetail(task: any) {
    const net = contributorNetPayoutAmount(task);
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
      budgetPerTask: net.toFixed(2),
      budgetLabel: this.formatBudgetLabelFromAmount(net, task.scheduleType),
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
    };
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

  private formatBudgetLabelFromAmount(amount: number, scheduleType: string): string {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
    if (scheduleType === 'FIXED') {
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
      updateData.resourceLink = updateTaskDto.resourceLink;
    }
    if (updateTaskDto.audiencePreferences !== undefined) {
      updateData.audiencePreferences = updateTaskDto.audiencePreferences;
    }

    const mergedCategory = updateTaskDto.category ?? (task as any).category;
    const mergedContentType =
      updateTaskDto.contentType !== undefined
        ? updateTaskDto.contentType
        : (task as any).contentType;
    const mergedBudget = updateTaskDto.budget ?? Number((task as any).budget);
    const pricingFieldsTouched =
      updateTaskDto.budget !== undefined ||
      updateTaskDto.category !== undefined ||
      updateTaskDto.contentType !== undefined ||
      updateTaskDto.contributorCount !== undefined;

    if (pricingFieldsTouched) {
      const estimate = computeTaskPricingEstimate(this.taskPricing, {
        category: mergedCategory,
        contentType: mergedContentType,
        contributorCount: updateTaskDto.contributorCount ?? (task as any).contributorSlots,
        budget: mergedBudget,
      });

      // Only the budget a caller actually supplied is checked. Otherwise
      // changing headcount alone would be validated against the stored budget,
      // which is by definition stale the moment the slot count moves.
      if (
        updateTaskDto.budget !== undefined &&
        !isBudgetAlignedWithPricing(updateTaskDto.budget, estimate)
      ) {
        throw new BadRequestException(
          `Budget must be ${estimate.totalBudget} NGN — ${estimate.unitRate} × ` +
            `${estimate.contributorSlots} contributors = ${estimate.payoutPool} paid out in full, plus ` +
            `${estimate.platformFeePercentage}% platform fee (${estimate.platformFee}). ` +
            `Omit budget entirely to have it recalculated for you.`,
        );
      }

      updateData.contributorSlots = estimate.contributorSlots;
      updateData.payoutPool = estimate.payoutPool;
      updateData.platformFeePercentage = estimate.platformFeePercentage;
      updateData.budgetPerTask = estimate.grossPerContributor;
      updateData.totalBudget = estimate.totalBudget;
      // Recalculated, so a headcount change repriced the campaign correctly
      // instead of leaving the old funded total attached to new slot count.
      updateData.budget = estimate.totalBudget;
    } else {
      const mergedPrefs =
        updateTaskDto.audiencePreferences ?? (task as any).audiencePreferences;
      const mergedTargeting = updateTaskDto.targeting ?? (task as any).targeting;
      const slots = resolveContributorSlotsForPersistence({
        explicitContributorCount: updateTaskDto.contributorCount,
        contributorSlots: (task as any).contributorSlots,
        taskType: updateTaskDto.taskType ?? (task as any).taskType,
        budget: mergedBudget,
        budgetPerTask: (task as any).budgetPerTask,
        audiencePreferences: mergedPrefs,
        targeting: mergedTargeting,
      });
      if (
        updateTaskDto.contributorCount !== undefined ||
        updateTaskDto.audiencePreferences !== undefined
      ) {
        updateData.contributorSlots = slots;
        // Headcount changed but funding did not, so the pool is unchanged and
        // only the per-contributor share moves. Divide the pool, never the
        // funded total — that would pay the platform fee out to contributors.
        updateData.budgetPerTask =
          resolvePayoutPool({
            payoutPool: (task as any).payoutPool,
            budget: mergedBudget,
          }) / slots;
        updateData.totalBudget = mergedBudget;
      }
    }

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

    const requiredContributors = resolveRequiredContributorSlots(task);
    const filledContributorSlots = await this.prisma.taskApplication.count({
      where: {
        taskId,
        status: {
          in: [ApplicationStatus.APPROVED, ApplicationStatus.COMPLETED],
        },
      },
    });
    if (filledContributorSlots >= requiredContributors) {
      throw new BadRequestException(
        'This campaign already has the maximum number of contributors',
      );
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

    // Email notifications (best-effort — never block the application flow).
    try {
      const creator = await this.prisma.user.findUnique({
        where: { id: task.creatorId },
        select: { email: true },
      });
      if (creator?.email) {
        await this.emailService.sendNewApplicationReceived(creator.email, {
          campaignTitle: task.title,
          applicantName: user.email,
        });
      }

      // If the applicant was auto-approved, let them know immediately.
      if (status === ApplicationStatus.APPROVED) {
        await this.emailService.sendApplicationApproved(user.email, {
          campaignTitle: task.title,
        });
      }
    } catch (error) {
      this.logger.warn(`Application email failed: ${error.message}`);
    }

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
        task: true,
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

    const shaped = applications.map(({ submissions: _omitSubs, ...app }) => ({
      ...app,
      task: this.sanitizeTaskForContributorView(app.task),
    }));

    return {
      message: 'My jobs retrieved successfully',
      data: {
        applications: shaped,
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

  private async settleCampaignRefund(task: {
    id: string;
    title: string;
    creatorId: string;
    budget: any;
  }): Promise<{ refundedAmount: number; paidOutAmount: number }> {
    const submissions = await this.prisma.taskSubmission.findMany({
      where: { taskId: task.id },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);

    const paidOutAggregate = submissionIds.length
      ? await this.prisma.walletTransaction.aggregate({
          where: {
            referenceId: { in: submissionIds },
            transactionCategory: TransactionCategory.TASK_PAYOUT,
            status: TransactionStatus.COMPLETED,
          },
          _sum: { amount: true },
        })
      : { _sum: { amount: null } };

    const paidOutAmount = Number(paidOutAggregate._sum.amount ?? 0);
    const grossBudget = Number(task.budget ?? 0);
    const refundedAmount = Math.max(0, grossBudget - paidOutAmount);

    if (refundedAmount > 0) {
      await this.walletService.credit(
        task.creatorId,
        refundedAmount,
        TransactionCategory.REFUND,
        `Refund for campaign settlement: ${task.title}`,
        { referenceId: task.id, taskId: task.id },
      );
    }

    return { refundedAmount, paidOutAmount };
  }

  async pauseTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only pause your own campaigns');
    }
    if (task.status !== TaskStatus.ACTIVE) {
      throw new BadRequestException('Only active campaigns can be paused');
    }

    const settlement = await this.settleCampaignRefund(task);

    const pausedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.PAUSED,
        paymentStatus:
          settlement.refundedAmount > 0 ? ('REFUNDED' as any) : undefined,
      },
    });

    await this.prisma.notification.create({
      data: {
        receiverId: userId,
        type: 'SYSTEM_ALERT',
        title: 'Campaign paused and settled',
        message: `Campaign paused. Refunded ₦${settlement.refundedAmount.toFixed(2)} (paid out: ₦${settlement.paidOutAmount.toFixed(2)}).`,
        data: {
          taskId: task.id,
          refundedAmount: settlement.refundedAmount,
          paidOutAmount: settlement.paidOutAmount,
        },
      },
    });

    return {
      message: 'Campaign paused successfully and funds settled',
      data: {
        task: pausedTask,
        settlement,
      },
    };
  }

  async endTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only end your own campaigns');
    }
    if (
      task.status !== TaskStatus.ACTIVE &&
      task.status !== TaskStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Only active or paused campaigns can be ended',
      );
    }

    const settlement = await this.settleCampaignRefund(task);
    const endedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        paymentStatus:
          settlement.refundedAmount > 0 ? ('REFUNDED' as any) : undefined,
      },
    });

    return {
      message: 'Campaign ended successfully and funds settled',
      data: {
        task: endedTask,
        settlement,
      },
    };
  }

  async terminateTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.creatorId !== userId) {
      throw new ForbiddenException('You can only terminate your own campaigns');
    }
    if (
      task.status !== TaskStatus.ACTIVE &&
      task.status !== TaskStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Only active or paused campaigns can be terminated',
      );
    }

    const feePercentage = parseFloat(
      this.configService.get<string>(
        'CAMPAIGN_TERMINATION_FEE_PERCENTAGE',
        '10',
      ),
    );

    // Calculate how much has already been paid out to contributors
    const submissions = await this.prisma.taskSubmission.findMany({
      where: { taskId },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);
    const paidOutAggregate = submissionIds.length
      ? await this.prisma.walletTransaction.aggregate({
          where: {
            referenceId: { in: submissionIds },
            transactionCategory: TransactionCategory.TASK_PAYOUT,
            status: TransactionStatus.COMPLETED,
          },
          _sum: { amount: true },
        })
      : { _sum: { amount: null } };

    const paidOutAmount = Number(paidOutAggregate._sum.amount ?? 0);
    const grossBudget = Number(task.budget ?? 0);
    const grossRemainingAmount = Math.max(0, grossBudget - paidOutAmount);
    const terminationFeeAmount = grossRemainingAmount * (feePercentage / 100);
    const netRefundAmount = grossRemainingAmount - terminationFeeAmount;

    // Refund is NOT credited yet — it's held pending manual admin processing
    // (see AdminService.processCampaignTerminationRequest), which pays out
    // the creator within 24 hours and only then credits the wallet.
    const terminationRequest =
      await this.prisma.campaignTerminationRequest.create({
        data: {
          taskId,
          creatorId: userId,
          grossRemainingAmount,
          terminationFeePercentage: feePercentage,
          terminationFeeAmount,
          netRefundAmount,
        },
      });

    const terminatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.TERMINATED },
    });

    // Notify all admins (in-app + email) to manually process the refund
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] as any }, status: 'ACTIVE' as any },
    });
    await Promise.all(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            receiverId: admin.id,
            type: 'SYSTEM_ALERT',
            title: 'Campaign Cancelled — Refund Needs Processing',
            message: `Creator cancelled campaign "${task.title}". Net refund owed: ₦${netRefundAmount.toFixed(2)} (fee: ₦${terminationFeeAmount.toFixed(2)}). Please process this within 24 hours.`,
            data: {
              taskId,
              terminationRequestId: terminationRequest.id,
              grossRemainingAmount,
              terminationFeeAmount,
              netRefundAmount,
            },
          },
        }),
      ),
    );
    await Promise.all(
      admins
        .filter((admin) => admin.email)
        .map((admin) =>
          this.emailService.sendCampaignTerminationAdminAlert(admin.email, {
            campaignTitle: task.title,
            netRefundAmount,
            terminationFeeAmount,
            terminationRequestId: terminationRequest.id,
          }),
        ),
    );

    // Notify creator
    await this.prisma.notification.create({
      data: {
        receiverId: userId,
        type: 'SYSTEM_ALERT',
        title: 'Campaign cancelled — refund in progress',
        message: `Your campaign "${task.title}" has been cancelled. A refund of ₦${netRefundAmount.toFixed(2)} (${feePercentage}% cancellation fee applied) is being processed by our team and will be paid to you within 24 hours.`,
        data: {
          taskId,
          terminationRequestId: terminationRequest.id,
          grossRemainingAmount,
          terminationFeeAmount,
          netRefundAmount,
        },
      },
    });

    return {
      message:
        'Campaign cancelled successfully. Your refund is pending admin processing and will be paid within 24 hours.',
      data: {
        task: terminatedTask,
        termination: {
          grossRemainingAmount,
          terminationFeePercentage: feePercentage,
          terminationFeeAmount,
          netRefundAmount,
          requestId: terminationRequest.id,
          status: terminationRequest.status,
        },
      },
    };
  }

  async createCampaignDispute(
    userId: string,
    taskId: string,
    reason: string,
    evidence: string[] = [],
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.creatorId !== userId) {
      throw new ForbiddenException(
        'You can only open disputes for your own campaigns',
      );
    }

    const existingOpen = await this.prisma.campaignDispute.findFirst({
      where: {
        taskId,
        creatorId: userId,
        status: {
          in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
        },
      },
    });
    if (existingOpen) {
      throw new BadRequestException(
        'An open dispute already exists for this campaign',
      );
    }

    const dispute = await this.prisma.campaignDispute.create({
      data: {
        taskId,
        creatorId: userId,
        reason,
        evidence: evidence as any,
      },
    });

    return {
      message: 'Dispute submitted successfully for admin review',
      data: dispute,
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

    // Announce it to contributors. Deliberately not awaited: a slow or failing
    // mail provider must not hold up (or fail) the publish request.
    void this.notifyContributorsOfNewTask(publishedTask);

    return {
      message: 'Task published successfully. It is now visible to contributors.',
      data: publishedTask,
    };
  }

  /**
   * Email every eligible contributor that a task just went live.
   *
   * Walks the contributor list in batches rather than loading it all at once,
   * so this stays flat in memory as the user base grows. Anything that goes
   * wrong is logged and swallowed — the task is already published by this point.
   */
  private async notifyContributorsOfNewTask(task: any): Promise<void> {
    const enabled =
      (this.configService.get<string>('TASK_BROADCAST_EMAIL_ENABLED') || 'true')
        .trim()
        .toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.log(
        `[task-broadcast] skipped taskId=${task.id} (TASK_BROADCAST_EMAIL_ENABLED=false)`,
      );
      return;
    }

    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
      const platforms = Array.isArray(task.platforms)
        ? (task.platforms as any[]).filter((p) => typeof p === 'string')
        : [];

      const details = {
        campaignTitle: task.title,
        taskUrl: `${frontendUrl.replace(/\/$/, '')}/tasks/${task.id}`,
        category: TASK_CATEGORY_LABELS[task.category as string] ?? undefined,
        platforms,
        payout: contributorNetPayoutAmount(task),
        closesAt: task.scheduleEnd ?? undefined,
      };

      // Page size doubles as the broadcast chunk handed to the mail transport.
      const pageSize = 100;
      let cursor: string | undefined;
      let sent = 0;
      let failed = 0;

      for (;;) {
        const contributors = await this.prisma.user.findMany({
          where: {
            userType: 'CONTRIBUTOR' as any,
            status: 'ACTIVE' as any,
            emailVerified: true,
            id: { not: task.creatorId },
          },
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true } },
          },
          orderBy: { id: 'asc' },
          take: pageSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        if (contributors.length === 0) {
          break;
        }

        const result = await this.emailService.sendNewTaskAvailable(
          contributors.map((c) => ({
            email: c.email,
            firstName: c.profile?.firstName,
          })),
          details,
        );
        sent += result.sent;
        failed += result.failed;

        cursor = contributors[contributors.length - 1].id;
        if (contributors.length < pageSize) {
          break;
        }
      }

      this.logger.log(
        `[task-broadcast] taskId=${task.id} sent=${sent} failed=${failed}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[task-broadcast] failed for taskId=${task.id}: ${err.message}`,
        err.stack,
      );
    }
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

    const charge = this.resolveChargeBreakdown(taskData);
    const totalAmount = charge.total;

    const existingReference = taskData.paymentReference as string | null | undefined;
    const existingStatus = taskData.paymentStatus as string | null | undefined;
    const paymentReference =
      existingReference && existingStatus === 'PENDING'
        ? existingReference
        : `TASK_${Date.now()}_${taskId.substring(0, 8)}`;
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
    const paystackReference = paymentResponse.data.reference || paymentReference;

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        paymentReference: paystackReference,
        paymentAuthorizationUrl: paymentUrl,
        paymentStatus: 'PENDING' as any,
      } as any,
    });

    // amountInKobo: Paystack SDK expects amount in kobo (Naira × 100)
    const amountInKobo = Math.round(totalAmount * 100);
    const paystackPublicKey =
      this.configService.get<string>('PAYSTACK_PUBLIC_KEY')?.trim() || '';

    return {
      message: 'Payment initiated. Use these values with Paystack SDK, then call POST /tasks/payment/verify with the reference when payment completes.',
      data: {
        reference: paystackReference,
        amountInKobo,
        amount: totalAmount,
        email: user.email,
        authorizationUrl: paymentUrl,
        paystackPublicKey,
        paystackMode: this.paystackService.getKeyMode(),
        breakdown: {
          // What contributors are paid, and the fee the creator adds on top.
          payoutPool: charge.payoutPool,
          platformFee: charge.platformFee,
          total: charge.total,
        },
      },
    };
  }

  async verifyPayment(userId: string, reference: string) {
    const paymentReference = reference.trim();
    const logCtx = { step: 'verifyPayment', reference: paymentReference, userId };

    this.logger.log(`[payment-verify] start ${JSON.stringify(logCtx)}`);

    if (!paymentReference) {
      this.logger.warn(`[payment-verify] abort: empty reference ${JSON.stringify(logCtx)}`);
      throw new BadRequestException('Payment reference is required');
    }

    let task = await this.prisma.task.findUnique({
      where: { paymentReference } as any,
    });

    this.logger.log(
      `[payment-verify] task_lookup_by_reference found=${!!task} taskId=${task?.id ?? null} paymentStatus=${task ? (task as any).paymentStatus : null}`,
    );

    if (task && (task as any).paymentStatus === 'PAID') {
      if (task.creatorId !== userId) {
        this.logger.warn(
          `[payment-verify] abort: already_paid_wrong_owner taskId=${task.id} owner=${task.creatorId}`,
        );
        throw new ForbiddenException('You can only verify payment for your own tasks');
      }
      this.logger.log(`[payment-verify] idempotent already PAID taskId=${task.id}`);
      return {
        message: 'Payment already verified',
        data: { task, payment: null },
      };
    }

    let verification: Awaited<ReturnType<PaystackService['verifyPayment']>>;
    try {
      verification = await this.paystackService.verifyPayment(paymentReference);
    } catch (error) {
      this.logger.warn(
        `[payment-verify] paystack_api_error reference=${paymentReference} mode=${this.paystackService.getKeyMode()} message=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    const paystackData = verification.data as any;
    this.logger.log(
      `[payment-verify] paystack_response ${JSON.stringify(this.summarizePaystackTransaction(paystackData))}`,
    );

    const paystackReference = (paystackData.reference as string) || paymentReference;
    const metadata = parsePaystackMetadata(paystackData.metadata);
    this.logger.log(`[payment-verify] parsed_metadata ${JSON.stringify(metadata)}`);

    if (!task) {
      task = await this.findTaskForPayment(paymentReference, metadata.taskId);
      this.logger.log(
        `[payment-verify] task_lookup_fallback found=${!!task} taskId=${task?.id ?? null} metadataTaskId=${metadata.taskId ?? null}`,
      );
    }

    if (!task) {
      this.logger.warn(
        `[payment-verify] abort: no_task_for_reference reference=${paymentReference} metadata=${JSON.stringify(metadata)}`,
      );
      throw new NotFoundException(
        'Payment succeeded on Paystack but no task is linked to this reference. Contact support with the reference.',
      );
    }

    if (task.creatorId !== userId) {
      this.logger.warn(
        `[payment-verify] abort: wrong_owner taskId=${task.id} creatorId=${task.creatorId} userId=${userId}`,
      );
      throw new ForbiddenException('You can only verify payment for your own tasks');
    }

    if ((task as any).paymentStatus === 'PAID') {
      this.logger.log(`[payment-verify] idempotent already PAID (post-paystack) taskId=${task.id}`);
      return {
        message: 'Payment already verified',
        data: { task, payment: null },
      };
    }

    if (paystackData.status !== 'success') {
      const gatewayResponse = paystackData.gateway_response ?? paystackData.message ?? null;
      this.logger.warn(
        `[payment-verify] abort: paystack_status_not_success taskId=${task.id} ${JSON.stringify({
          paystackStatus: paystackData.status,
          gatewayResponse,
          reference: paystackReference,
        })}`,
      );
      await this.prisma.task.update({
        where: { id: task.id },
        data: { paymentStatus: 'FAILED' as any } as any,
      });
      throw new BadRequestException(
        `Payment verification failed: Paystack transaction status is "${paystackData.status}"` +
          (gatewayResponse ? ` (${gatewayResponse})` : '') +
          '. Complete payment on Paystack or use a successful charge reference.',
      );
    }

    this.assertPaystackVerificationMatchesTask(task, paystackData, metadata);

    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        paymentStatus: 'PAID' as any,
        paymentVerifiedAt: new Date(),
        paymentReference: paystackReference,
      } as any,
    });

    const paidAt = paystackData.paid_at ?? paystackData.paidAt ?? null;

    this.logger.log(
      `[payment-verify] success taskId=${task.id} reference=${paystackReference} amountKobo=${paystackData.amount}`,
    );

    return {
      message: 'Payment verified successfully',
      data: {
        task: updatedTask,
        payment: {
          reference: paystackReference,
          amount: Number(paystackData.amount) / 100,
          status: paystackData.status,
          paidAt,
        },
      },
    };
  }

  private async findTaskForPayment(reference: string, metadataTaskId?: string) {
    if (metadataTaskId) {
      const byMetadata = await this.prisma.task.findUnique({
        where: { id: metadataTaskId },
      });
      if (byMetadata) {
        return byMetadata;
      }
    }

    return this.prisma.task.findUnique({
      where: { paymentReference: reference } as any,
    });
  }

  /** Safe fields for logs (no card/customer PII). */
  private summarizePaystackTransaction(data: any): Record<string, unknown> {
    if (!data) return {};
    return {
      reference: data.reference,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      gateway_response: data.gateway_response,
      paid_at: data.paid_at ?? data.paidAt,
      channel: data.channel,
      metadata: parsePaystackMetadata(data.metadata),
    };
  }

  /**
   * What the creator is charged at checkout, in Naira.
   *
   * `budget` on a current campaign is already all-in (payout pool + platform
   * fee), so the charge IS the budget — adding the fee again would bill it
   * twice. Legacy campaigns predate `payoutPool`: their budget is the bare pool
   * and the fee was applied at checkout, so those keep the old sum.
   *
   * Initialization and verification both go through here; when they each did
   * their own arithmetic, a change to one silently broke the other.
   */
  private resolveChargeBreakdown(task: any): {
    payoutPool: number;
    platformFee: number;
    total: number;
  } {
    const budgetAmount = Number(task.budget) || 0;
    const platformFeePercentage = Number(task.platformFeePercentage) || 7;

    if (task.payoutPool !== null && task.payoutPool !== undefined) {
      const payoutPool = Number(task.payoutPool) || 0;
      return {
        payoutPool,
        platformFee: Math.round((budgetAmount - payoutPool) * 100) / 100,
        total: budgetAmount,
      };
    }

    const platformFee =
      Math.round(((budgetAmount * platformFeePercentage) / 100) * 100) / 100;
    return {
      payoutPool: budgetAmount,
      platformFee,
      total: budgetAmount + platformFee,
    };
  }

  private resolveChargeableAmount(task: any): number {
    return this.resolveChargeBreakdown(task).total;
  }

  private assertPaystackVerificationMatchesTask(
    task: any,
    paystackData: any,
    metadata: Record<string, string>,
  ): void {
    const budgetAmount = Number(task.budget) || 0;
    const platformFeePercentage = Number(task.platformFeePercentage) || 7;
    const expectedAmountKobo = Math.round(this.resolveChargeableAmount(task) * 100);
    const paidAmountKobo = Number(paystackData.amount);

    this.logger.log(
      `[payment-verify] assert_match taskId=${task.id} paidKobo=${paidAmountKobo} expectedKobo=${expectedAmountKobo} metadata=${JSON.stringify(metadata)}`,
    );

    if (Math.abs(paidAmountKobo - expectedAmountKobo) > 1) {
      this.logger.warn(
        `[payment-verify] abort: amount_mismatch taskId=${task.id} paid=${paidAmountKobo} expected=${expectedAmountKobo} budget=${budgetAmount} feePct=${platformFeePercentage}`,
      );
      throw new BadRequestException(
        `Payment amount does not match task total (paid ${paidAmountKobo} kobo, expected ${expectedAmountKobo} kobo)`,
      );
    }

    if (paystackData.currency && paystackData.currency !== 'NGN') {
      this.logger.warn(
        `[payment-verify] abort: invalid_currency taskId=${task.id} currency=${paystackData.currency}`,
      );
      throw new BadRequestException('Payment currency must be NGN');
    }

    if (metadata.taskId && metadata.taskId !== task.id) {
      this.logger.warn(
        `[payment-verify] abort: metadata_task_mismatch taskId=${task.id} metadataTaskId=${metadata.taskId}`,
      );
      throw new BadRequestException('Payment metadata does not match this task');
    }
    if (metadata.userId && metadata.userId !== task.creatorId) {
      this.logger.warn(
        `[payment-verify] abort: metadata_owner_mismatch taskId=${task.id} metadataUserId=${metadata.userId} creatorId=${task.creatorId}`,
      );
      throw new BadRequestException('Payment metadata does not match task owner');
    }
    if (metadata.type && metadata.type !== 'TASK_PAYMENT') {
      this.logger.warn(
        `[payment-verify] abort: metadata_type_mismatch taskId=${task.id} metadataType=${metadata.type}`,
      );
      throw new BadRequestException('Payment metadata type is invalid');
    }
  }

  private async markTaskPaidFromPaystack(
    reference: string,
    paystackData: any,
  ): Promise<void> {
    const metadata = parsePaystackMetadata(paystackData.metadata);
    const task = await this.findTaskForPayment(reference, metadata.taskId);
    if (!task || (task as any).paymentStatus === 'PAID') {
      return;
    }

    this.assertPaystackVerificationMatchesTask(task, paystackData, metadata);

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        paymentStatus: 'PAID' as any,
        paymentVerifiedAt: new Date(),
        paymentReference: paystackData.reference || reference,
      } as any,
    });
  }

  async handlePaymentWebhook(payload: any) {
    try {
      const event = payload.event;
      const data = payload.data;

      if (event === 'charge.success' || event === 'transaction.success') {
        const reference = data.reference as string;
        const verification = await this.paystackService.verifyPayment(reference);

        if (verification.data.status === 'success') {
          await this.markTaskPaidFromPaystack(reference, verification.data);
        }
      } else if (event === 'charge.failed' || event === 'transaction.failed') {
        const reference = data.reference as string;
        const metadata = parsePaystackMetadata(data.metadata);
        const task = await this.findTaskForPayment(reference, metadata.taskId);

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

