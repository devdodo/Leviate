import { BadRequestException } from '@nestjs/common';
import {
  assertNinIdentityMatchesProfile,
  assertProfileHasLegalNamesForNin,
  formatNinIdentityName,
} from './nin-verification.util';

describe('nin-verification.util', () => {
  describe('assertProfileHasLegalNamesForNin', () => {
    it('accepts a profile with both legal names', () => {
      expect(() =>
        assertProfileHasLegalNamesForNin({ firstName: 'Ada', lastName: 'Obi' }),
      ).not.toThrow();
    });

    it.each([
      ['missing profile', null],
      ['missing last name', { firstName: 'Ada', lastName: null }],
      ['blank first name', { firstName: '   ', lastName: 'Obi' }],
    ])('rejects a profile with %s', (_label, profile) => {
      expect(() =>
        assertProfileHasLegalNamesForNin(profile as any),
      ).toThrow(BadRequestException);
    });
  });

  describe('formatNinIdentityName', () => {
    it('includes the middle name when present', () => {
      expect(
        formatNinIdentityName({
          firstName: 'Ada',
          middleName: 'Chidi',
          lastName: 'Obi',
        }),
      ).toBe('Ada Chidi Obi');
    });

    it('skips a null or blank middle name', () => {
      expect(
        formatNinIdentityName({
          firstName: 'Ada',
          middleName: '  ',
          lastName: 'Obi',
        }),
      ).toBe('Ada Obi');
    });
  });

  describe('assertNinIdentityMatchesProfile', () => {
    const profile = { firstName: 'Ada', lastName: 'Obi' };

    it('accepts an exact match', () => {
      expect(() =>
        assertNinIdentityMatchesProfile(profile, {
          firstName: 'Ada',
          lastName: 'Obi',
        }),
      ).not.toThrow();
    });

    it('accepts a match regardless of order, case, or extra middle name', () => {
      expect(() =>
        assertNinIdentityMatchesProfile(profile, {
          firstName: 'OBI',
          middleName: 'Chidi',
          lastName: 'ADA',
        }),
      ).not.toThrow();
    });

    it('accepts a match when the profile name carries punctuation or accents', () => {
      expect(() =>
        assertNinIdentityMatchesProfile(
          { firstName: "Adá-Ngözi", lastName: 'Obi' },
          { firstName: 'Ada', middleName: 'Ngozi', lastName: 'Obi' },
        ),
      ).not.toThrow();
    });

    it('rejects when only one name part matches', () => {
      expect(() =>
        assertNinIdentityMatchesProfile(profile, {
          firstName: 'Ada',
          lastName: 'Nwosu',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a completely different identity', () => {
      expect(() =>
        assertNinIdentityMatchesProfile(profile, {
          firstName: 'Emeka',
          lastName: 'Nwosu',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
