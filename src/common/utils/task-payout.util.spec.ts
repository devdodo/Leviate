import {
  contributorGrossPerShare,
  contributorNetPayoutAmount,
  extractContributorCountFromJson,
  inferContributorSlotsFromBudgetFields,
  resolveContributorSlots,
  resolveRequiredContributorSlots,
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

  it('ignores legacy budgetPerTask when it stores the full campaign budget', () => {
    expect(
      contributorGrossPerShare({
        contributorSlots: 10,
        budget: 100000,
        budgetPerTask: 100000,
      }),
    ).toBe(10000);
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 10,
        budget: 100000,
        budgetPerTask: 100000,
        platformFeePercentage: 5,
      }),
    ).toBe(9500);
  });

  it('splits a single-slot campaign and applies platform fee', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 1,
        budget: 812250,
        platformFeePercentage: 5,
      }),
    ).toBe(771637.5);
  });

  it('allotted pay is budget ÷ required contributors, not ÷ workers who showed up', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 20,
        budget: 800000,
        platformFeePercentage: 5,
      }),
    ).toBe(38000);
    expect(
      resolveRequiredContributorSlots({
        contributorSlots: 20,
        budget: 800000,
      }),
    ).toBe(20);
  });
});
