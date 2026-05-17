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
  const gross = Number(budget ?? 0);
  const perTask = Number(budgetPerTask ?? 0);

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
 * Planned contributor headcount used to split task budget (display + payout).
 * Does not use how many applications are approved at payout time.
 */
export function resolveContributorSlots(task: ContributorSlotsInput): number {
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

export function contributorNetPayoutAmount(task: ContributorSlotsInput): number {
  const gross = Number(task.budget ?? 0);
  const feePct = Number(task.platformFeePercentage ?? 5);
  const slots = resolveContributorSlots(task);
  const perGross = gross / slots;
  const net = (perGross * (100 - feePct)) / 100;
  return Math.round(net * 100) / 100;
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
