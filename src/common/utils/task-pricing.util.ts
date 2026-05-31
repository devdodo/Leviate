/** Per-slot rates in Naira (category base + optional content-type premium). */

export const DEFAULT_CATEGORY_AMOUNTS: Record<string, number> = {
  LIKE_SHARE_SAVE_REPOST: 1000,
  COMMENT_POST: 2000,
  MAKE_POST: 5000,
  FOLLOW_ACCOUNT: 1000,
};

export const DEFAULT_CONTENT_TYPE_AMOUNTS: Record<string, number> = {
  VIDEO: 3000,
  IMAGE: 1500,
  TEXT: 500,
};

export type TaskPricingConfig = {
  categories: Record<string, number>;
  contentTypes: Record<string, number>;
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

  return { categories, contentTypes };
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

export function getUnitRate(
  config: TaskPricingConfig,
  category: string,
  contentType?: string | null,
): number {
  return getCategoryAmount(config, category) + getContentTypeAmount(config, contentType);
}

/**
 * Total budget = unitRate × contributorSlots.
 * Slots from explicit count, or floor(budget / unitRate) when only budget is given.
 */
export function estimateTaskPricing(
  config: TaskPricingConfig,
  input: TaskPricingEstimateInput,
): TaskPricingEstimate {
  const categoryAmount = getCategoryAmount(config, input.category);
  const contentTypeAmount = getContentTypeAmount(config, input.contentType);
  const unitRate = categoryAmount + contentTypeAmount;

  if (unitRate <= 0) {
    throw new Error(`No pricing configured for category ${input.category}`);
  }

  const platformFeePercentage = Number(input.platformFeePercentage ?? 5);
  const explicitSlots = parseContributorCount(input.contributorCount);
  const budget = input.budget != null ? Number(input.budget) : null;

  let contributorSlots: number;
  if (explicitSlots) {
    contributorSlots = explicitSlots;
  } else if (budget != null && budget > 0) {
    contributorSlots = Math.max(1, Math.floor(budget / unitRate));
  } else {
    contributorSlots = 1;
  }

  const totalBudget = unitRate * contributorSlots;
  const grossPerContributor = unitRate;
  const platformFee = (totalBudget * platformFeePercentage) / 100;
  const netBudget = totalBudget - platformFee;
  const netPerContributor = (grossPerContributor * (100 - platformFeePercentage)) / 100;

  return {
    categoryAmount,
    contentTypeAmount,
    unitRate,
    contributorSlots,
    totalBudget,
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
