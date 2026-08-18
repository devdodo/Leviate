import {
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  estimateTaskPricing,
  getPostRate,
  isBudgetAlignedWithPricing,
  loadTaskPricingConfig,
  LOCKED_CATEGORY_AMOUNTS,
  LOCKED_CONTENT_TYPE_PREMIUMS,
} from './task-pricing.util';

describe('task-pricing.util', () => {
  const config = {
    categories: { ...LOCKED_CATEGORY_AMOUNTS },
    contentTypes: { ...LOCKED_CONTENT_TYPE_PREMIUMS },
    platformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
  };

  it('ignores env attempts to override the locked rates', () => {
    const loaded = loadTaskPricingConfig((key) =>
      ({
        TASK_CONTENT_TYPE_AMOUNT_VIDEO: '4000',
        TASK_CATEGORY_AMOUNT_MAKE_POST: '500',
        TASK_CATEGORY_AMOUNT_FOLLOW_ACCOUNT: '450',
        TASK_PRICING_JSON: '{"categories":{"COMMENT_POST":999}}',
      })[key],
    );
    expect(loaded.contentTypes.VIDEO).toBe(3300);
    expect(loaded.categories.MAKE_POST).toBe(200);
    expect(loaded.categories.FOLLOW_ACCOUNT).toBe(150);
    expect(loaded.categories.COMMENT_POST).toBe(120);
  });

  it('loads the platform fee from env, defaulting to 7%', () => {
    expect(loadTaskPricingConfig().platformFeePercentage).toBe(7);
    expect(
      loadTaskPricingConfig((key) =>
        key === 'PLATFORM_FEE_PERCENTAGE' ? '10' : undefined,
      ).platformFeePercentage,
    ).toBe(10);
  });

  describe('locked rates', () => {
    const cases: Array<[string, string | undefined, number]> = [
      ['MAKE_POST', 'TEXT', 200],
      ['MAKE_POST', 'IMAGE', 200],
      ['MAKE_POST', 'VIDEO', 3500],
      ['LIKE_SHARE_SAVE_REPOST', 'TEXT', 120],
      ['COMMENT_POST', 'TEXT', 120],
      ['FOLLOW_ACCOUNT', 'TEXT', 150],
    ];

    it.each(cases)('prices %s / %s at %i per contributor', (category, contentType, expected) => {
      const estimate = estimateTaskPricing(config, {
        category,
        contentType,
        contributorCount: 1,
      });
      expect(estimate.unitRate).toBe(expected);
    });

    // The contributor is paid the locked rate with nothing taken off.
    it.each(cases)('pays the full %s / %s rate of %i to the contributor', (category, contentType, expected) => {
      const estimate = estimateTaskPricing(config, {
        category,
        contentType,
        contributorCount: 25,
      });
      expect(estimate.payoutPerContributor).toBe(expected);
      expect(estimate.netPerContributor).toBe(expected);
      expect(estimate.payoutPool).toBe(expected * 25);
    });

    // What the task-types endpoint serves as contentTypes[].amount.
    it('quotes post rates of 200 / 200 / 3500 for text / image / video', () => {
      expect(getPostRate(config, 'TEXT')).toBe(200);
      expect(getPostRate(config, 'IMAGE')).toBe(200);
      expect(getPostRate(config, 'VIDEO')).toBe(3500);
    });
  });

  it('does not charge the content-type premium on engagement tasks', () => {
    for (const category of ['LIKE_SHARE_SAVE_REPOST', 'COMMENT_POST', 'FOLLOW_ACCOUNT']) {
      const text = estimateTaskPricing(config, { category, contentType: 'TEXT', contributorCount: 1 });
      const video = estimateTaskPricing(config, { category, contentType: 'VIDEO', contributorCount: 1 });
      expect(video.unitRate).toBe(text.unitRate);
      expect(video.contentTypeAmount).toBe(0);
    }
  });

  it('charges the platform fee to the creator on top of the payout pool', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'MAKE_POST',
      contentType: 'TEXT',
      contributorCount: 100,
    });
    expect(estimate.payoutPool).toBe(20000);
    expect(estimate.platformFeePercentage).toBe(7);
    expect(estimate.platformFee).toBe(1400);
    expect(estimate.totalBudget).toBe(21400);
    // The fee falls entirely on the creator; the contributor keeps the rate.
    expect(estimate.payoutPerContributor).toBe(200);
    expect(estimate.netPerContributor).toBe(200);
    // The pool alone is what gets paid out.
    expect(estimate.payoutPerContributor * estimate.contributorSlots).toBe(
      estimate.payoutPool,
    );
  });

  it('derives contributor slots from an all-in budget when count omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'COMMENT_POST',
      contentType: 'TEXT',
      budget: 25875,
    });
    expect(estimate.unitRate).toBe(120);
    // 25,875 / (120 x 1.07) = 201.5 -> 201 slots
    expect(estimate.contributorSlots).toBe(201);
    expect(estimate.payoutPool).toBe(24120);
    expect(estimate.totalBudget).toBe(25808.4);
  });

  it('uses category amount only when content type omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'FOLLOW_ACCOUNT',
      contributorCount: 3,
    });
    expect(estimate.unitRate).toBe(150);
    expect(estimate.payoutPool).toBe(450);
    expect(estimate.totalBudget).toBe(481.5);
  });

  it('accepts a budget within the rounding tolerance', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'MAKE_POST',
      contentType: 'VIDEO',
      contributorCount: 10,
    });
    expect(estimate.totalBudget).toBe(37450);
    expect(isBudgetAlignedWithPricing(37450, estimate)).toBe(true);
    expect(isBudgetAlignedWithPricing(37449, estimate)).toBe(true);
    expect(isBudgetAlignedWithPricing(35000, estimate)).toBe(false);
  });
});
