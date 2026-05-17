import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  normalizeNameForComparison,
  profileNamesMatchPaystackAccount,
} from './legal-name.util';

type ProfileNameFields = {
  firstName: string | null;
  lastName: string | null;
  legalNamesLockedAt: Date | null;
};

export const MAX_BANK_ACCOUNTS_PER_USER = 2;

export function assertProfileHasLegalNames(
  profile: ProfileNameFields | null | undefined,
): asserts profile is ProfileNameFields & {
  firstName: string;
  lastName: string;
} {
  const firstName = profile?.firstName?.trim();
  const lastName = profile?.lastName?.trim();

  if (!firstName || !lastName) {
    throw new BadRequestException(
      'Please update your profile with your legal first and last name before adding a bank account.',
    );
  }
}

export function assertPaystackAccountNameMatchesProfile(
  profile: { firstName: string; lastName: string },
  paystackAccountName: string,
): void {
  if (
    !profileNamesMatchPaystackAccount(
      profile.firstName,
      profile.lastName,
      paystackAccountName,
    )
  ) {
    throw new BadRequestException(
      'The name on your bank account does not match the name on your profile. At least two name parts must match.',
    );
  }
}

export function assertLegalNameUpdatesAllowed(
  profile: ProfileNameFields | null | undefined,
  incomingFirstName?: string,
  incomingLastName?: string,
): void {
  if (incomingFirstName === undefined && incomingLastName === undefined) {
    return;
  }

  if (profile?.legalNamesLockedAt) {
    throw new ForbiddenException(
      'Your legal name cannot be changed. Contact support if you need assistance.',
    );
  }

  if (incomingFirstName !== undefined && profile?.firstName) {
    const current = normalizeNameForComparison(profile.firstName);
    const next = normalizeNameForComparison(incomingFirstName);
    if (current && next && current !== next) {
      throw new ForbiddenException('Your legal first name cannot be changed.');
    }
  }

  if (incomingLastName !== undefined && profile?.lastName) {
    const current = normalizeNameForComparison(profile.lastName);
    const next = normalizeNameForComparison(incomingLastName);
    if (current && next && current !== next) {
      throw new ForbiddenException('Your legal last name cannot be changed.');
    }
  }
}

export function legalNamesLockUpdate(
  profile: ProfileNameFields | null | undefined,
  mergedFirstName?: string | null,
  mergedLastName?: string | null,
): { legalNamesLockedAt?: Date } {
  if (profile?.legalNamesLockedAt) {
    return {};
  }

  const firstName = (mergedFirstName ?? profile?.firstName)?.trim();
  const lastName = (mergedLastName ?? profile?.lastName)?.trim();

  if (firstName && lastName) {
    return { legalNamesLockedAt: new Date() };
  }

  return {};
}
