import {
  contributorNetPayoutAmount,
  extractContributorCountFromJson,
  inferContributorSlotsFromBudgetFields,
  resolveContributorSlots,
} from './task-payout.util';

describe('task-payout.util', () => {
  it('uses contributorSlots column when set', () => {
    expect(
      resolveContributorSlots({
        contributorSlots: 10,
        budget: 100000,
      }),
    ).toBe(10);
  });

  it('does not divide by approved application count', () => {
    expect(
      resolveContributorSlots({
        contributorSlots: 5,
        budget: 100000,
      }),
    ).toBe(5);
  });

  it('reads contributor count from nested audiencePreferences', () => {
    expect(
      extractContributorCountFromJson({
        campaign: { contributorCount: 8 },
      }),
    ).toBe(8);
  });

  it('infers slots from budget and budgetPerTask', () => {
    expect(inferContributorSlotsFromBudgetFields(100000, 10000)).toBe(10);
  });

  it('calculates net per-contributor payout after platform fee', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 10,
        budget: 100000,
        platformFeePercentage: 5,
      }),
    ).toBe(9500);
  });
});
