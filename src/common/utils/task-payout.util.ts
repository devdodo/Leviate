import { TransactionCategory, TransactionStatus } from '@prisma/client';

/** Keys that may hold planned contributor headcount on task JSON fields. */
const CONTRIBUTOR_COUNT_KEYS = new Set([
  'contributorCount',
  'maxContributors',
  'contributorsWanted',
  'contributors',
  'numberOfContributors',
  'numContributors',
  'contributorSlots',
  'requiredContributors',
  'totalContributors',
  'contributorsCount',
  'contributor_count',
  'max_contributors',
]);

/** Prisma Decimal, string, or number → number. */
export function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function resolvePlatformFeePercentage(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 5;
  }
  const n = toNumber(value);
  if (!Number.isFinite(n) || n < 0) {
    return 5;
  }
  if (n > 100) {
    return 100;
  }
  return n;
}

export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(Math.floor(n), 50000);
}

/** Deep-search JSON objects for a contributor headcount field. */
export function extractContributorCountFromJson(
  value: unknown,
  depth = 0,
): number | null {
  if (value === undefined || value === null || depth > 5) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const [key, fieldValue] of Object.entries(record)) {
    if (CONTRIBUTOR_COUNT_KEYS.has(key)) {
      const parsed = parsePositiveInt(fieldValue);
      if (parsed) {
        return parsed;
      }
    }
  }

  for (const fieldValue of Object.values(record)) {
    if (fieldValue && typeof fieldValue === 'object') {
      const nested = extractContributorCountFromJson(fieldValue, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

/**
 * Infer planned slots when legacy `budgetPerTask` was stored as gross per-contributor share.
 */
export function inferContributorSlotsFromBudgetFields(
  budget: unknown,
  budgetPerTask: unknown,
): number | null {
  const gross = toNumber(budget);
  const perTask = toNumber(budgetPerTask);

  if (!(gross > 0 && perTask > 0) || perTask >= gross * 0.99) {
    return null;
  }

  const slots = Math.round(gross / perTask);
  if (slots >= 2 && slots <= 50000) {
    return slots;
  }

  return null;
}

export type ContributorSlotsInput = {
  contributorSlots?: number | null;
  taskType?: string | null;
  budget?: unknown;
  budgetPerTask?: unknown;
  platformFeePercentage?: unknown;
  audiencePreferences?: unknown;
  targeting?: unknown;
};

/**
 * Required contributor headcount set when the campaign is created (stored as contributor_slots).
 * Each completed, verified submission is paid budget ÷ this number — not split among whoever actually worked.
 */
export function resolveRequiredContributorSlots(task: ContributorSlotsInput): number {
  const fromColumn = parsePositiveInt(task.contributorSlots);
  if (fromColumn) {
    return fromColumn;
  }

  const fromPrefs =
    extractContributorCountFromJson(task.audiencePreferences) ??
    extractContributorCountFromJson(task.targeting);
  if (fromPrefs) {
    return fromPrefs;
  }

  const fromBudget = inferContributorSlotsFromBudgetFields(
    task.budget,
    task.budgetPerTask,
  );
  if (fromBudget) {
    return fromBudget;
  }

  if (task.taskType === 'SINGLE') {
    return 1;
  }

  return 1;
}

/** @deprecated Use resolveRequiredContributorSlots */
export function resolveContributorSlots(task: ContributorSlotsInput): number {
  return resolveRequiredContributorSlots(task);
}

/** Gross Naira for one contributor slot: total budget ÷ required contributors (not ÷ who actually worked). */
export function contributorGrossPerShare(task: ContributorSlotsInput): number {
  const gross = toNumber(task.budget);
  const slots = resolveRequiredContributorSlots(task);
  if (!(gross > 0 && slots > 0)) {
    return 0;
  }
  return Math.round((gross / slots) * 100) / 100;
}

/** Net Naira each contributor earns after platform fee. */
export function contributorNetPayoutAmount(task: ContributorSlotsInput): number {
  const perGross = contributorGrossPerShare(task);
  const feePct = resolvePlatformFeePercentage(task.platformFeePercentage);
  const net = (perGross * (100 - feePct)) / 100;
  return Math.round(net * 100) / 100;
}

export function contributorPayoutBreakdown(task: ContributorSlotsInput): {
  requiredContributors: number;
  grossPerContributor: number;
  netPerContributor: number;
  platformFeePercentage: number;
} {
  const requiredContributors = resolveRequiredContributorSlots(task);
  const grossPerContributor = contributorGrossPerShare(task);
  const platformFeePercentage = resolvePlatformFeePercentage(task.platformFeePercentage);
  const netPerContributor = contributorNetPayoutAmount(task);
  return {
    requiredContributors,
    grossPerContributor,
    netPerContributor,
    platformFeePercentage,
  };
}

/** Completed TASK_PAYOUT wallet credits for a campaign (one per verified contributor slot used). */
export async function countCompletedTaskPayouts(
  prisma: {
    taskSubmission: {
      findMany: (args: {
        where: { taskId: string };
        select: { id: true };
      }) => Promise<Array<{ id: string }>>;
    };
    walletTransaction: {
      count: (args: {
        where: {
          referenceId: { in: string[] };
          transactionCategory: TransactionCategory;
          status: TransactionStatus;
        };
      }) => Promise<number>;
    };
  },
  taskId: string,
  transactionCategory: TransactionCategory,
  transactionStatusCompleted: TransactionStatus,
): Promise<number> {
  const submissions = await prisma.taskSubmission.findMany({
    where: { taskId },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);
  if (submissionIds.length === 0) {
    return 0;
  }
  return prisma.walletTransaction.count({
    where: {
      referenceId: { in: submissionIds },
      transactionCategory,
      status: transactionStatusCompleted,
    },
  });
}

export function resolveContributorSlotsForPersistence(
  input: ContributorSlotsInput & { explicitContributorCount?: unknown },
): number {
  const explicit = parsePositiveInt(input.explicitContributorCount);
  if (explicit) {
    return explicit;
  }
  return resolveContributorSlots(input);
}
