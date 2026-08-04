import { BadRequestException } from '@nestjs/common';
import { profileNamesMatchIdentityName } from './legal-name.util';

type ProfileNameFields = {
  firstName: string | null;
  lastName: string | null;
};

type NinIdentityNames = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
};

/** Full NIMC name, middle name included so it counts toward the token match. */
export function formatNinIdentityName(identity: NinIdentityNames): string {
  return [identity.firstName, identity.middleName, identity.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ');
}

export function assertProfileHasLegalNamesForNin(
  profile: ProfileNameFields | null | undefined,
): asserts profile is ProfileNameFields & {
  firstName: string;
  lastName: string;
} {
  const firstName = profile?.firstName?.trim();
  const lastName = profile?.lastName?.trim();

  if (!firstName || !lastName) {
    throw new BadRequestException(
      'Please add your legal first and last name to your profile before verifying your NIN.',
    );
  }
}

/**
 * The check that gives NIN verification its teeth: the NIMC record must belong
 * to the person who owns this profile, not merely be a valid NIN.
 */
export function assertNinIdentityMatchesProfile(
  profile: { firstName: string; lastName: string },
  identity: NinIdentityNames,
): void {
  if (
    !profileNamesMatchIdentityName(
      profile.firstName,
      profile.lastName,
      formatNinIdentityName(identity),
    )
  ) {
    throw new BadRequestException(
      'The name on this NIN does not match the name on your profile. At least two name parts must match.',
    );
  }
}
