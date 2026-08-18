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

  it('pays the contributor the full share, taking no platform fee', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 10,
        payoutPool: 100000,
        budget: 107000,
        platformFeePercentage: 7,
      }),
    ).toBe(10000);
  });

  it('divides the payout pool, never the fee-inclusive funded budget', () => {
    // Creator funded 107,000 = 100,000 pool + 7% fee. Contributors split the
    // pool only; dividing `budget` would hand them the platform fee.
    expect(
      contributorGrossPerShare({
        contributorSlots: 10,
        payoutPool: 100000,
        budget: 107000,
      }),
    ).toBe(10000);
  });

  it('falls back to budget as the pool for pre-fee-move campaigns', () => {
    // Campaigns created before the fee moved to the creator funded the pool
    // exactly, so budget IS the pool and contributors get the full rate.
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 93,
        budget: 325500,
        payoutPool: null,
        platformFeePercentage: 5,
      }),
    ).toBe(3500);
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
    ).toBe(10000);
  });

  it('gives a single-slot campaign the whole pool', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 1,
        payoutPool: 812250,
        budget: 869107.5,
        platformFeePercentage: 7,
      }),
    ).toBe(812250);
  });

  it('allotted pay is budget ÷ required contributors, not ÷ workers who showed up', () => {
    expect(
      contributorNetPayoutAmount({
        contributorSlots: 20,
        payoutPool: 800000,
        platformFeePercentage: 7,
      }),
    ).toBe(40000);
    expect(
      resolveRequiredContributorSlots({
        contributorSlots: 20,
        budget: 800000,
      }),
    ).toBe(20);
  });
});
