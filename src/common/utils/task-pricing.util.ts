/**
 * Per-slot rates in Naira (category base + content-type premium).
 *
 * The content-type premium applies ONLY to MAKE_POST, where the contributor
 * actually produces the media. Engagement tasks (like/comment/follow) cost the
 * same whatever the target post contains, so they are flat.
 *
 * Locked rates, expressed as the totals a creator pays per contributor:
 *   text post 200 | image post 200 | video post 3500
 *   like/share/save/repost 120 | comment 120 | follow 150
 *
 * Only video carries a premium — an image post is priced the same as a text post.
 */
export const DEFAULT_CATEGORY_AMOUNTS: Record<string, number> = {
  LIKE_SHARE_SAVE_REPOST: 120,
  COMMENT_POST: 120,
  MAKE_POST: 200,
  FOLLOW_ACCOUNT: 150,
};

/** Premium added on top of MAKE_POST only. TEXT and IMAGE are the zero baseline. */
export const DEFAULT_CONTENT_TYPE_AMOUNTS: Record<string, number> = {
  VIDEO: 3300,
  IMAGE: 0,
  TEXT: 0,
};

/** Categories where the contributor produces media, so content type affects price. */
const CONTENT_PRICED_CATEGORIES = new Set(['MAKE_POST']);

/** Payment-processing charge added on top of the contributor payout pool. */
export const DEFAULT_PROCESSING_FEE_PERCENTAGE = 3.5;

export type TaskPricingConfig = {
  categories: Record<string, number>;
  contentTypes: Record<string, number>;
  processingFeePercentage: number;
};

export type TaskPricingEstimateInput = {
  category: string;
  contentType?: string | null;
  contributorCount?: number | null;
  budget?: number | null;
  platformFeePercentage?: number;
  processingFeePercentage?: number;
};

export type TaskPricingEstimate = {
  categoryAmount: number;
  contentTypeAmount: number;
  unitRate: number;
  contributorSlots: number;
  /** unitRate × contributorSlots — what contributors collectively gross. */
  payoutPool: number;
  processingFeePercentage: number;
  /** Payment-processing charge added on top of the pool. */
  processingFee: number;
  /** What the creator funds: payoutPool + processingFee. */
  totalBudget: number;
  grossPerContributor: number;
  platformFeePercentage: number;
  platformFee: number;
  netPerContributor: number;
  netBudget: number;
};

function parsePositiveAmount(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

/** Build pricing tables from env (see env.example TASK_CATEGORY_AMOUNT_* / TASK_CONTENT_TYPE_AMOUNT_*). */
export function loadTaskPricingConfig(
  getEnv: (key: string) => string | undefined = () => undefined,
): TaskPricingConfig {
  const categories: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_CATEGORY_AMOUNTS)) {
    categories[key] = parsePositiveAmount(getEnv(`TASK_CATEGORY_AMOUNT_${key}`), fallback);
  }

  const contentTypes: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_CONTENT_TYPE_AMOUNTS)) {
    contentTypes[key] = parsePositiveAmount(getEnv(`TASK_CONTENT_TYPE_AMOUNT_${key}`), fallback);
  }

  const processingFeePercentage = parsePositiveAmount(
    getEnv('PROCESSING_FEE_PERCENTAGE'),
    DEFAULT_PROCESSING_FEE_PERCENTAGE,
  );

  const jsonOverride = getEnv('TASK_PRICING_JSON');
  if (jsonOverride?.trim()) {
    try {
      const parsed = JSON.parse(jsonOverride) as Partial<TaskPricingConfig>;
      if (parsed.categories && typeof parsed.categories === 'object') {
        Object.assign(categories, parsed.categories);
      }
      if (parsed.contentTypes && typeof parsed.contentTypes === 'object') {
        Object.assign(contentTypes, parsed.contentTypes);
      }
    } catch {
      // ignore invalid JSON; use env keys / defaults
    }
  }

  return { categories, contentTypes, processingFeePercentage };
}

export function getCategoryAmount(
  config: TaskPricingConfig,
  category: string,
): number {
  return config.categories[category] ?? 0;
}

export function getContentTypeAmount(
  config: TaskPricingConfig,
  contentType?: string | null,
): number {
  if (!contentType) {
    return 0;
  }
  return config.contentTypes[contentType] ?? 0;
}

/**
 * The premium a given category actually charges for its content type. Zero for
 * engagement tasks, so liking a video costs the same as liking a text post.
 */
export function getApplicableContentTypeAmount(
  config: TaskPricingConfig,
  category: string,
  contentType?: string | null,
): number {
  if (!CONTENT_PRICED_CATEGORIES.has(category)) {
    return 0;
  }
  return getContentTypeAmount(config, contentType);
}

export function getUnitRate(
  config: TaskPricingConfig,
  category: string,
  contentType?: string | null,
): number {
  return (
    getCategoryAmount(config, category) +
    getApplicableContentTypeAmount(config, category, contentType)
  );
}

/**
 * payoutPool  = unitRate × contributorSlots
 * totalBudget = payoutPool + processing charge (what the creator funds)
 *
 * Slots come from an explicit count, or from floor(budget / all-in per slot)
 * when only a budget is given.
 */
export function estimateTaskPricing(
  config: TaskPricingConfig,
  input: TaskPricingEstimateInput,
): TaskPricingEstimate {
  const categoryAmount = getCategoryAmount(config, input.category);
  const contentTypeAmount = getApplicableContentTypeAmount(
    config,
    input.category,
    input.contentType,
  );
  const unitRate = categoryAmount + contentTypeAmount;

  if (unitRate <= 0) {
    throw new Error(`No pricing configured for category ${input.category}`);
  }

  const platformFeePercentage = Number(input.platformFeePercentage ?? 5);
  const processingFeePercentage = Number(
    input.processingFeePercentage ?? config.processingFeePercentage,
  );
  const explicitSlots = parseContributorCount(input.contributorCount);
  const budget = input.budget != null ? Number(input.budget) : null;

  // A budget-only estimate quotes an all-in figure, so back the processing
  // charge out before deriving slots — otherwise it buys slots it can't fund.
  const perSlotAllIn = unitRate * (1 + processingFeePercentage / 100);

  let contributorSlots: number;
  if (explicitSlots) {
    contributorSlots = explicitSlots;
  } else if (budget != null && budget > 0) {
    contributorSlots = Math.max(1, Math.floor(budget / perSlotAllIn));
  } else {
    contributorSlots = 1;
  }

  const payoutPool = unitRate * contributorSlots;
  const processingFee = (payoutPool * processingFeePercentage) / 100;
  const totalBudget = payoutPool + processingFee;

  const grossPerContributor = unitRate;
  // The platform fee is charged on contributor earnings, not on the
  // processing charge, so it is calculated from the pool.
  const platformFee = (payoutPool * platformFeePercentage) / 100;
  const netBudget = payoutPool - platformFee;
  const netPerContributor = (grossPerContributor * (100 - platformFeePercentage)) / 100;

  return {
    categoryAmount,
    contentTypeAmount,
    unitRate,
    contributorSlots,
    payoutPool,
    processingFeePercentage,
    processingFee: Math.round(processingFee * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    grossPerContributor,
    platformFeePercentage,
    platformFee: Math.round(platformFee * 100) / 100,
    netPerContributor: Math.round(netPerContributor * 100) / 100,
    netBudget: Math.round(netBudget * 100) / 100,
  };
}

function parseContributorCount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(Math.floor(n), 50000);
}

/** Allow ±1 Naira rounding when client sends budget that does not divide evenly. */
export function isBudgetAlignedWithPricing(
  submittedBudget: number,
  estimate: TaskPricingEstimate,
  toleranceNaira = 1,
): boolean {
  return Math.abs(submittedBudget - estimate.totalBudget) <= toleranceNaira;
}
