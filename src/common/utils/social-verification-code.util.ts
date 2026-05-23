import { PrismaService } from '../services/prisma.service';

const CODE_PREFIX = 'LV-';
const CODE_BODY_LENGTH = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** e.g. LV-A3K9M2X7 — unique per user, used on all linked social bios. */
export function generateSocialVerificationCode(): string {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    body += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${CODE_PREFIX}${body}`;
}

export async function allocateUniqueSocialVerificationCode(
  prisma: PrismaService,
): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const socialVerificationCode = generateSocialVerificationCode();
    const existing = await prisma.user.findUnique({
      where: { socialVerificationCode },
      select: { id: true },
    });
    if (!existing) {
      return socialVerificationCode;
    }
  }
  throw new Error('Could not generate a unique social verification code');
}

export function normalizeSubmittedSocialCode(code: string): string {
  return code.trim().toUpperCase();
}
