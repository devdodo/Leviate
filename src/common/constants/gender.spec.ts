import {
  matchesTargetGender,
  TARGET_GENDERS,
  USER_GENDERS,
} from './gender';

describe('matchesTargetGender', () => {
  it('accepts everyone when the task sets no gender target', () => {
    for (const gender of [...USER_GENDERS, null, undefined]) {
      expect(matchesTargetGender(gender, null)).toBe(true);
      expect(matchesTargetGender(gender, undefined)).toBe(true);
      expect(matchesTargetGender(gender, 'ALL')).toBe(true);
    }
  });

  it('matches a contributor to their own gender only', () => {
    expect(matchesTargetGender('FEMALE', 'FEMALE')).toBe(true);
    expect(matchesTargetGender('FEMALE', 'MALE')).toBe(false);
    expect(matchesTargetGender('OTHER', 'OTHER')).toBe(true);
  });

  it('never pulls PREFER_NOT_TO_SAY into a gender-specific task', () => {
    for (const target of TARGET_GENDERS.filter((g) => g !== 'ALL')) {
      expect(matchesTargetGender('PREFER_NOT_TO_SAY', target)).toBe(false);
    }
  });

  it('excludes contributors who have not set a gender yet', () => {
    expect(matchesTargetGender(null, 'MALE')).toBe(false);
    expect(matchesTargetGender(undefined, 'FEMALE')).toBe(false);
  });
});
