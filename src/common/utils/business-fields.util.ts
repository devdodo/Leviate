import { BadRequestException } from '@nestjs/common';
import { UserType } from '@prisma/client';

export interface BusinessFieldsInput {
  isBusiness?: boolean;
  businessName?: string;
}

/**
 * businessName/isBusiness only make sense for CREATOR accounts (businesses
 * running campaigns). Validates and normalizes the pair for persistence.
 */
export function resolveCreatorBusinessFields(
  userType: UserType,
  input: BusinessFieldsInput,
): { isBusiness: boolean; businessName: string | null } {
  // Non-creators may still send isBusiness: false (the default the frontend
  // posts for contributors). Only reject an actual business claim.
  if (userType !== UserType.CREATOR) {
    if (input.isBusiness === true || input.businessName?.trim()) {
      throw new BadRequestException(
        'businessName and isBusiness are only accepted for creator accounts',
      );
    }
    return { isBusiness: false, businessName: null };
  }

  const isBusiness = input.isBusiness ?? false;

  if (!isBusiness) {
    if (input.businessName?.trim()) {
      throw new BadRequestException(
        'businessName must not be provided when isBusiness is false',
      );
    }
    return { isBusiness: false, businessName: null };
  }

  const businessName = input.businessName?.trim();
  if (!businessName) {
    throw new BadRequestException(
      'businessName is required when isBusiness is true',
    );
  }

  return { isBusiness: true, businessName };
}
