import {
  DEFAULT_CATEGORY_AMOUNTS,
  DEFAULT_CONTENT_TYPE_AMOUNTS,
  estimateTaskPricing,
  isBudgetAlignedWithPricing,
  loadTaskPricingConfig,
} from './task-pricing.util';

describe('task-pricing.util', () => {
  const config = {
    categories: { ...DEFAULT_CATEGORY_AMOUNTS },
    contentTypes: { ...DEFAULT_CONTENT_TYPE_AMOUNTS },
  };

  it('loads overrides from env keys', () => {
    const loaded = loadTaskPricingConfig((key) =>
      key === 'TASK_CONTENT_TYPE_AMOUNT_VIDEO' ? '4000' : undefined,
    );
    expect(loaded.contentTypes.VIDEO).toBe(4000);
    expect(loaded.contentTypes.TEXT).toBe(DEFAULT_CONTENT_TYPE_AMOUNTS.TEXT);
  });

  it('computes unit rate as category + content type amounts', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'MAKE_POST',
      contentType: 'VIDEO',
      contributorCount: 5,
    });
    expect(estimate.categoryAmount).toBe(5000);
    expect(estimate.contentTypeAmount).toBe(3000);
    expect(estimate.unitRate).toBe(8000);
    expect(estimate.contributorSlots).toBe(5);
    expect(estimate.totalBudget).toBe(40000);
    expect(estimate.grossPerContributor).toBe(8000);
  });

  it('derives contributor slots from budget when count omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'COMMENT_POST',
      contentType: 'TEXT',
      budget: 25000,
    });
    expect(estimate.unitRate).toBe(2500);
    expect(estimate.contributorSlots).toBe(10);
    expect(estimate.totalBudget).toBe(25000);
  });

  it('uses category amount only when content type omitted', () => {
    const estimate = estimateTaskPricing(config, {
      category: 'FOLLOW_ACCOUNT',
      contributorCount: 3,
    });
    expect(estimate.unitRate).toBe(1000);
    expect(estimate.totalBudget).toBe(3000);
  });
});
