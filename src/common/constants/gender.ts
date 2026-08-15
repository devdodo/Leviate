/**
 * Gender a contributor reports on their own profile.
 *
 * PREFER_NOT_TO_SAY is a deliberate answer, not a missing one: those
 * contributors are matched only against tasks open to every gender, never
 * against a task that asks for a specific one.
 */
export const USER_GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;

export type UserGender = (typeof USER_GENDERS)[number];

/**
 * Gender a creator can aim a task at. ALL means no gender filter and is the
 * behaviour when targeting.gender is omitted entirely.
 */
export const TARGET_GENDERS = ['ALL', 'MALE', 'FEMALE', 'OTHER'] as const;

export type TargetGender = (typeof TARGET_GENDERS)[number];

export const USER_GENDER_LABELS: Record<UserGender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const TARGET_GENDER_LABELS: Record<TargetGender, string> = {
  ALL: 'All genders',
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

/**
 * Whether a contributor's reported gender satisfies a task's target.
 * An absent target (or ALL) accepts everyone; a contributor who has not set a
 * gender, or who chose not to say, is never pulled into a gender-specific task.
 */
export function matchesTargetGender(
  contributorGender: UserGender | null | undefined,
  targetGender: TargetGender | null | undefined,
): boolean {
  if (!targetGender || targetGender === 'ALL') {
    return true;
  }
  return contributorGender === targetGender;
}
