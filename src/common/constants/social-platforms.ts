/** Supported social platforms for profile linking and verification. */
export const SOCIAL_PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'tiktok',
  'snapchat',
  'facebook',
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number];

export function isSocialPlatform(value: string): value is SocialPlatformId {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function normalizeSocialPlatform(value: string): SocialPlatformId {
  const platform = value.trim().toLowerCase();
  if (!isSocialPlatform(platform)) {
    throw new Error(`Unsupported platform: ${value}`);
  }
  return platform;
}
