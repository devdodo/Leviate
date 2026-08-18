/**
 * Per-slot rates in Naira (category base + content-type premium).
 *
 * The content-type premium applies ONLY to MAKE_POST, where the contributor
 * actually produces the media. Engagement tasks (like/comment/follow) cost the
 * same whatever the target post contains, so they are flat.
 *
 * LOCKED rates — the amount a contributor is paid, in full, per contribution:
 *   text post 200 | image post 200 | video post 3500
 *   like/share/save/repost 120 | comment 120 | follow 150
 *
 * Only video carries a premium — an image post is priced the same as a text post.
 *
 * These are deliberately NOT env-configurable. They used to be, and a stale
 * override on a deployed host silently served old prices while the code said
 * otherwise — the rates are business-critical, so they live here and change
 * only by a code edit that the tests have to agree with.
 */
export const LOCKED_CATEGORY_AMOUNTS: Record<string, number> = {
  LIKE_SHARE_SAVE_REPOST: 120,
  COMMENT_POST: 120,
  MAKE_POST: 200,
  FOLLOW_ACCOUNT: 150,
};

/** Premium added on top of MAKE_POST only. TEXT and IMAGE are the zero baseline. */
export const LOCKED_CONTENT_TYPE_PREMIUMS: Record<string, number> = {
  VIDEO: 3300,
  IMAGE: 0,
  TEXT: 0,
};

/** Categories where the contributor produces media, so content type affects price. */
const CONTENT_PRICED_CATEGORIES = new Set(['MAKE_POST']);

/**
 * Platform fee, charged to the CREATOR on top of the payout pool at task
 * creation. Contributors are never charged: they receive the full locked rate.
 *
 * This replaced an older split — a 5% deduction from contributor earnings plus
 * a separate processing charge on the creator. There is now exactly one fee, on
 * one side, so a rate quoted to a contributor is the amount they actually get.
 */
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 7;

export type TaskPricingConfig = {
  categories: Record<string, number>;
  contentTypes: Record<string, number>;
  platformFeePercentage: number;
};

export type TaskPricingEstimateInput = {
  category: string;
  contentType?: string | null;
  contributorCount?: number | null;
  budget?: number | null;
  platformFeePercentage?: number;
};

export type TaskPricingEstimate = {
  categoryAmount: number;
  contentTypeAmount: number;
  unitRate: number;
  contributorSlots: number;
  /** unitRate × contributorSlots — paid out to contributors in full. */
  payoutPool: number;
  platformFeePercentage: number;
  /** Charged to the creator on top of the pool. */
  platformFee: number;
  /** What the creator funds: payoutPool + platformFee. */
  totalBudget: number;
  /** What one contributor receives. No deduction — equal to unitRate. */
  payoutPerContributor: number;
  /** @deprecated Aliases of payoutPerContributor; gross and net are now equal. */
  grossPerContributor: number;
  /** @deprecated Aliases of payoutPerContributor; gross and net are now equal. */
  netPerContributor: number;
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

/**
 * Build the pricing config. The rate tables are the locked constants above and
 * ignore the environment entirely; only the platform fee reads from env, so it
 * can be tuned without a deploy.
 */
export function loadTaskPricingConfig(
  getEnv: (key: string) => string | undefined = () => undefined,
): TaskPricingConfig {
  const platformFeePercentage = parsePositiveAmount(
    getEnv('PLATFORM_FEE_PERCENTAGE'),
    DEFAULT_PLATFORM_FEE_PERCENTAGE,
  );

  return {
    categories: { ...LOCKED_CATEGORY_AMOUNTS },
    contentTypes: { ...LOCKED_CONTENT_TYPE_PREMIUMS },
    platformFeePercentage,
  };
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
 * What a contributor is paid per MAKE_POST of this content type — text 200,
 * image 200, video 3500. This is the number to show a user; the raw premium
 * (0 for text) is an implementation detail of how the total is built.
 */
export function getPostRate(
  config: TaskPricingConfig,
  contentType: string,
): number {
  return getUnitRate(config, 'MAKE_POST', contentType);
}

/**
 * payoutPool  = unitRate × contributorSlots   (contributors get this, in full)
 * totalBudget = payoutPool + platform fee     (what the creator funds)
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

  const platformFeePercentage = Number(
    input.platformFeePercentage ?? config.platformFeePercentage,
  );
  const explicitSlots = parseContributorCount(input.contributorCount);
  const budget = input.budget != null ? Number(input.budget) : null;

  // A budget-only estimate quotes an all-in figure, so back the platform fee
  // out before deriving slots — otherwise it buys slots it cannot fund.
  const perSlotAllIn = unitRate * (1 + platformFeePercentage / 100);

  let contributorSlots: number;
  if (explicitSlots) {
    contributorSlots = explicitSlots;
  } else if (budget != null && budget > 0) {
    contributorSlots = Math.max(1, Math.floor(budget / perSlotAllIn));
  } else {
    contributorSlots = 1;
  }

  const payoutPool = unitRate * contributorSlots;
  const platformFee = (payoutPool * platformFeePercentage) / 100;
  const totalBudget = payoutPool + platformFee;

  return {
    categoryAmount,
    contentTypeAmount,
    unitRate,
    contributorSlots,
    payoutPool,
    platformFeePercentage,
    platformFee: Math.round(platformFee * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    payoutPerContributor: unitRate,
    grossPerContributor: unitRate,
    netPerContributor: unitRate,
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
