import { ForbiddenException } from '@nestjs/common';
import {
  assertHobbiesInterestsUpdateAllowed,
  assertSocialMediaHandlesUpdateAllowed,
  HOBBIES_INTERESTS_COOLDOWN_DAYS,
} from './profile-field-cooldown.util';

describe('profile-field-cooldown.util', () => {
  it('allows first hobbies update when none saved yet', () => {
    expect(
      assertHobbiesInterestsUpdateAllowed(null, ['Music', 'Tech']),
    ).toBe(true);
  });

  it('blocks hobbies change within cooldown window', () => {
    const recent = new Date();
    expect(() =>
      assertHobbiesInterestsUpdateAllowed(
        {
          hobbiesInterests: ['Music'],
          hobbiesInterestsUpdatedAt: recent,
        },
        ['Sports'],
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows hobbies change after cooldown', () => {
    const old = new Date(
      Date.now() - (HOBBIES_INTERESTS_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    expect(
      assertHobbiesInterestsUpdateAllowed(
        {
          hobbiesInterests: ['Music'],
          hobbiesInterestsUpdatedAt: old,
        },
        ['Sports'],
      ),
    ).toBe(true);
  });

  it('skips social update when value unchanged', () => {
    const handles = { twitter: '@a' };
    expect(
      assertSocialMediaHandlesUpdateAllowed(
        {
          socialMediaHandles: handles,
          socialMediaHandlesUpdatedAt: new Date(),
        },
        handles,
      ),
    ).toBe(false);
  });
});
