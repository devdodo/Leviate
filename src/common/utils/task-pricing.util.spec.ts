import {
  DEFAULT_PROCESSING_FEE_PERCENTAGE,
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
    processingFeePercentage: DEFAULT_PROCESSING_FEE_PERCENTAGE,
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

  it('loads the processing fee from env, defaulting to 3.5%', () => {
    expect(loadTaskPricingConfig().processingFeePercentage).toBe(3.5);
    expect(
      loadTaskPricingConfig((key) =>
        key === 'PROCESSING_FEE_PERCENTAGE' ? '2' : undefined,
      ).processingFeePercentage,
    ).toBe(2);
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

  it('adds the processing charge on top of the payout pool', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'MAKE_POST',
      contentType: 'TEXT',
      contributorCount: 100,
    });
    expect(estimate.payoutPool).toBe(20000);
    expect(estimate.processingFee).toBe(700);
    expect(estimate.totalBudget).toBe(20700);
    // Contributors are unaffected by the processing charge.
    expect(estimate.grossPerContributor).toBe(200);
    expect(estimate.netPerContributor).toBe(190);
  });

  it('derives contributor slots from an all-in budget when count omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'COMMENT_POST',
      contentType: 'TEXT',
      budget: 25875,
    });
    expect(estimate.unitRate).toBe(120);
    // 25,875 / (120 x 1.035) = 208.3 -> 208 slots
    expect(estimate.contributorSlots).toBe(208);
    expect(estimate.totalBudget).toBe(25833.6);
  });

  it('uses category amount only when content type omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'FOLLOW_ACCOUNT',
      contributorCount: 3,
    });
    expect(estimate.unitRate).toBe(150);
    expect(estimate.payoutPool).toBe(450);
    expect(estimate.totalBudget).toBe(465.75);
  });

  it('accepts a budget within the rounding tolerance', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'MAKE_POST',
      contentType: 'VIDEO',
      contributorCount: 10,
    });
    expect(estimate.totalBudget).toBe(36225);
    expect(isBudgetAlignedWithPricing(36225, estimate)).toBe(true);
    expect(isBudgetAlignedWithPricing(36224, estimate)).toBe(true);
    expect(isBudgetAlignedWithPricing(35000, estimate)).toBe(false);
  });
});
