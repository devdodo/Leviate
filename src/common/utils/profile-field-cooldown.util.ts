import { ForbiddenException } from '@nestjs/common';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const HOBBIES_INTERESTS_COOLDOWN_DAYS = 30;
export const SOCIAL_MEDIA_HANDLES_COOLDOWN_DAYS = 90;

/**
 * Social handle 90-day cooldown (profile + link-social).
 * Disabled for testing — set to true and use PROFILE_SOCIAL_HANDLES_COOLDOWN_ENABLED=true in .env for production.
 */
export function isSocialMediaHandlesCooldownEnabled(): boolean {
  const testingBypass =
    process.env.PROFILE_SOCIAL_HANDLES_COOLDOWN_DISABLED?.trim().toLowerCase();
  if (
    testingBypass === '1' ||
    testingBypass === 'true' ||
    testingBypass === 'yes'
  ) {
    return false;
  }

  const enabled =
    process.env.PROFILE_SOCIAL_HANDLES_COOLDOWN_ENABLED?.trim().toLowerCase();
  return enabled === '1' || enabled === 'true' || enabled === 'yes';
}

type ProfileCooldownFields = {
  hobbiesInterests?: unknown;
  hobbiesInterestsUpdatedAt?: Date | null;
  socialMediaHandles?: unknown;
  socialMediaHandlesUpdatedAt?: Date | null;
};

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function jsonValuesEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function isEmptyJson(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

function daysUntilCooldownEnds(lastUpdatedAt: Date, cooldownDays: number): number {
  const elapsedMs = Date.now() - lastUpdatedAt.getTime();
  const cooldownMs = cooldownDays * MS_PER_DAY;
  const remainingMs = cooldownMs - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));
}

function formatNextAllowedDate(lastUpdatedAt: Date, cooldownDays: number): string {
  const next = new Date(
    lastUpdatedAt.getTime() + cooldownDays * MS_PER_DAY,
  );
  return next.toISOString().split('T')[0];
}

export function assertProfileFieldCooldown(
  lastUpdatedAt: Date | null | undefined,
  cooldownDays: number,
  fieldLabel: string,
): void {
  if (!lastUpdatedAt) {
    return;
  }

  const elapsedMs = Date.now() - lastUpdatedAt.getTime();
  if (elapsedMs < cooldownDays * MS_PER_DAY) {
    const nextDate = formatNextAllowedDate(lastUpdatedAt, cooldownDays);
    const daysLeft = daysUntilCooldownEnds(lastUpdatedAt, cooldownDays);
    throw new ForbiddenException(
      `${fieldLabel} can only be updated once every ${cooldownDays} days. You can update again on ${nextDate} (${daysLeft} day(s) remaining).`,
    );
  }
}

export function assertHobbiesInterestsUpdateAllowed(
  profile: ProfileCooldownFields | null | undefined,
  incoming: string[] | undefined,
): boolean {
  if (incoming === undefined) {
    return false;
  }

  const existing = profile?.hobbiesInterests;
  if (jsonValuesEqual(existing, incoming)) {
    return false;
  }

  if (!isEmptyJson(existing)) {
    assertProfileFieldCooldown(
      profile?.hobbiesInterestsUpdatedAt,
      HOBBIES_INTERESTS_COOLDOWN_DAYS,
      'Hobbies and interests',
    );
  }

  return true;
}

export function assertSocialMediaHandlesUpdateAllowed(
  profile: ProfileCooldownFields | null | undefined,
  incoming: Record<string, unknown> | undefined,
): boolean {
  if (incoming === undefined) {
    return false;
  }

  const existing = profile?.socialMediaHandles;
  if (jsonValuesEqual(existing, incoming)) {
    return false;
  }

  if (!isEmptyJson(existing) && isSocialMediaHandlesCooldownEnabled()) {
    assertProfileFieldCooldown(
      profile?.socialMediaHandlesUpdatedAt,
      SOCIAL_MEDIA_HANDLES_COOLDOWN_DAYS,
      'Social media handles',
    );
  }

  return true;
}

export function assertSocialMediaPartialUpdateAllowed(
  profile: ProfileCooldownFields | null | undefined,
): void {
  if (
    !isEmptyJson(profile?.socialMediaHandles) &&
    isSocialMediaHandlesCooldownEnabled()
  ) {
    assertProfileFieldCooldown(
      profile?.socialMediaHandlesUpdatedAt,
      SOCIAL_MEDIA_HANDLES_COOLDOWN_DAYS,
      'Social media handles',
    );
  }
}
