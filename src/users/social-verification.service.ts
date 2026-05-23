import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AdminActionType,
  SocialVerificationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import {
  SOCIAL_PLATFORMS,
  normalizeSocialPlatform,
} from '../common/constants/social-platforms';
import {
  allocateUniqueSocialVerificationCode,
  normalizeSubmittedSocialCode,
} from '../common/utils/social-verification-code.util';
import { SubmitSocialVerificationDto } from './dto/submit-social-verification.dto';
import { ListSocialVerificationsQueryDto } from '../admin/dto/list-social-verifications-query.dto';

type ProfileHandles = Record<string, string | undefined>;

@Injectable()
export class SocialVerificationService {
  constructor(private prisma: PrismaService) {}

  /** Personal code created at registration — same code for every platform for this user. */
  async getUserSocialVerificationCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { socialVerificationCode: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.socialVerificationCode) {
      return user.socialVerificationCode;
    }

    const socialVerificationCode =
      await allocateUniqueSocialVerificationCode(this.prisma);
    await this.prisma.user.update({
      where: { id: userId },
      data: { socialVerificationCode },
    });
    return socialVerificationCode;
  }

  async getInstructions(userId: string) {
    const verificationCode = await this.getUserSocialVerificationCode(userId);
    return {
      message: 'Social verification instructions retrieved successfully',
      data: {
        verificationCode,
        instructions: [
          `This code is unique to your account and was created when you registered.`,
          `Link a social account (POST /api/users/link-social), then add this code to that platform's public bio: ${verificationCode}`,
          `Submit with POST /api/users/social-verification/submit for each platform you want verified.`,
          `Use the same code on every platform — our team verifies each account separately.`,
        ],
      },
    };
  }

  /** Linked social accounts with verification status (for GET /users/me). */
  async getConnectedSocials(userId: string) {
    const { platforms, verificationCode } =
      await this.buildPlatformStatuses(userId);

    const connectedSocials = platforms
      .filter((p) => p.handle)
      .map((p) => ({
        platform: p.platform,
        handle: p.handle,
        isApproved: p.status === SocialVerificationStatus.VERIFIED,
      }));

    return { verificationCode, connectedSocials };
  }

  async getMyPlatformStatuses(userId: string) {
    const { platforms, verificationCode } =
      await this.buildPlatformStatuses(userId);

    return {
      message: 'Social verification status retrieved successfully',
      data: {
        verificationCode,
        platforms,
      },
    };
  }

  private async buildPlatformStatuses(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const handles = (user.profile?.socialMediaHandles as ProfileHandles) || {};
    const records = await this.prisma.userSocialVerification.findMany({
      where: { userId },
    });
    const byPlatform = new Map(records.map((r) => [r.platform, r]));

    const platforms = SOCIAL_PLATFORMS.map((platform) => {
      const handle = handles[platform]?.trim() || null;
      const record = byPlatform.get(platform);

      if (!handle) {
        return {
          platform,
          handle: null,
          profileUrl: null,
          status: 'NOT_LINKED' as const,
          verificationId: null,
          submittedAt: null,
          reviewedAt: null,
          adminComment: null,
        };
      }

      const status =
        record?.status ?? SocialVerificationStatus.AWAITING_SUBMISSION;
      return {
        platform,
        handle,
        profileUrl: record?.profileUrl ?? null,
        status,
        verificationId: record?.id ?? null,
        submittedCode: record?.submittedCode ?? null,
        submittedAt: record?.submittedAt ?? null,
        reviewedAt: record?.reviewedAt ?? null,
        adminComment:
          status === SocialVerificationStatus.REJECTED
            ? record?.adminComment ?? null
            : null,
      };
    });

    const verificationCode = await this.getUserSocialVerificationCode(userId);

    return { verificationCode, platforms };
  }

  async submitVerification(
    userId: string,
    dto: SubmitSocialVerificationDto,
  ) {
    let platform;
    try {
      platform = normalizeSocialPlatform(dto.platform);
    } catch {
      throw new BadRequestException(`Unsupported platform: ${dto.platform}`);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const handles = (user.profile?.socialMediaHandles as ProfileHandles) || {};
    const handle = handles[platform]?.trim();
    if (!handle) {
      throw new BadRequestException(
        `Link your ${platform} account first (POST /api/users/link-social).`,
      );
    }

    const expectedCode = await this.getUserSocialVerificationCode(userId);
    if (
      normalizeSubmittedSocialCode(dto.submittedCode) !==
      normalizeSubmittedSocialCode(expectedCode)
    ) {
      throw new BadRequestException(
        'Submitted code does not match your account verification code. Use GET /api/users/social-verification/instructions to see your code.',
      );
    }

    const record = await this.prisma.userSocialVerification.upsert({
      where: {
        userId_platform: { userId, platform },
      },
      create: {
        userId,
        platform,
        handle,
        submittedCode: dto.submittedCode.trim(),
        status: SocialVerificationStatus.PENDING,
        submittedAt: new Date(),
      },
      update: {
        handle,
        submittedCode: dto.submittedCode.trim(),
        status: SocialVerificationStatus.PENDING,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        adminComment: null,
      },
    });

    return {
      message:
        'Verification submitted. Our team will review your profile manually.',
      data: {
        verificationId: record.id,
        platform,
        status: record.status,
        submittedAt: record.submittedAt,
      },
    };
  }

  /** Called when a user links or updates a social handle. */
  async syncAfterLink(
    userId: string,
    platform: string,
    handle: string,
    profileUrl?: string,
  ) {
    const normalized = normalizeSocialPlatform(platform);
    const existing = await this.prisma.userSocialVerification.findUnique({
      where: { userId_platform: { userId, platform: normalized } },
    });

    if (!existing) {
      await this.prisma.userSocialVerification.create({
        data: {
          userId,
          platform: normalized,
          handle,
          profileUrl: profileUrl ?? null,
          status: SocialVerificationStatus.AWAITING_SUBMISSION,
        },
      });
      return;
    }

    const handleChanged =
      existing.handle.trim().toLowerCase() !== handle.trim().toLowerCase();

    await this.prisma.userSocialVerification.update({
      where: { id: existing.id },
      data: {
        handle,
        profileUrl: profileUrl ?? existing.profileUrl,
        ...(handleChanged || existing.status === SocialVerificationStatus.REJECTED
          ? {
              status: SocialVerificationStatus.AWAITING_SUBMISSION,
              submittedCode: null,
              submittedAt: null,
              reviewedAt: null,
              reviewedById: null,
              adminComment: null,
            }
          : {}),
      },
    });
  }

  async listForAdmin(query: ListSocialVerificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = query.status ?? SocialVerificationStatus.PENDING;

    const where: {
      status: SocialVerificationStatus;
      platform?: string;
    } = { status };

    if (query.platform) {
      try {
        where.platform = normalizeSocialPlatform(query.platform);
      } catch {
        throw new BadRequestException(`Unsupported platform: ${query.platform}`);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.userSocialVerification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
              socialVerificationCode: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  socialMediaHandles: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.userSocialVerification.count({ where }),
    ]);

    return {
      message: 'Social verification queue retrieved successfully',
      data: items.map((row) => this.mapAdminListItem(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getByIdForAdmin(id: string) {
    const row = await this.prisma.userSocialVerification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            userType: true,
            socialVerificationCode: true,
            profile: true,
          },
        },
        reviewedBy: { select: { id: true, email: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Social verification request not found');
    }
    return {
      message: 'Social verification retrieved successfully',
      data: {
        ...this.mapAdminListItem(row),
        requiredVerificationCode: row.user.socialVerificationCode,
        user: row.user,
        reviewedBy: row.reviewedBy,
      },
    };
  }

  async getByUserIdForAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const statusResult = await this.getMyPlatformStatuses(userId);
    const records = await this.prisma.userSocialVerification.findMany({
      where: { userId },
      orderBy: { platform: 'asc' },
      include: {
        reviewedBy: { select: { id: true, email: true } },
      },
    });

    return {
      message: 'User social verifications retrieved successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          profile: user.profile,
        },
        requiredVerificationCode: user.socialVerificationCode,
        platforms: statusResult.data.platforms,
        verifications: records,
      },
    };
  }

  async approve(adminId: string, id: string, comment?: string) {
    await this.assertStaff(adminId);
    const row = await this.getPendingOrThrow(id);

    const updated = await this.prisma.userSocialVerification.update({
      where: { id },
      data: {
        status: SocialVerificationStatus.VERIFIED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        adminComment: comment ?? null,
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId,
        actionType: AdminActionType.VERIFY_SOCIAL_MEDIA,
        targetUserId: row.userId,
        reason: comment ?? `Verified ${row.platform} social profile`,
      },
    });

    await this.prisma.notification.create({
      data: {
        receiverId: row.userId,
        type: 'SYSTEM_ALERT',
        title: 'Social profile verified',
        message: `Your ${row.platform} account (${row.handle}) has been verified.`,
        data: { platform: row.platform, verificationId: id },
      },
    });

    return {
      message: 'Social profile verified successfully',
      data: updated,
    };
  }

  async reject(adminId: string, id: string, comment: string) {
    await this.assertStaff(adminId);
    const row = await this.getPendingOrThrow(id);

    const updated = await this.prisma.userSocialVerification.update({
      where: { id },
      data: {
        status: SocialVerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        adminComment: comment,
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId,
        actionType: AdminActionType.REJECT_SOCIAL_MEDIA,
        targetUserId: row.userId,
        reason: comment,
      },
    });

    await this.prisma.notification.create({
      data: {
        receiverId: row.userId,
        type: 'SYSTEM_ALERT',
        title: 'Social profile verification rejected',
        message: `Your ${row.platform} verification was rejected: ${comment}`,
        data: { platform: row.platform, verificationId: id },
      },
    });

    return {
      message: 'Social verification rejected',
      data: updated,
    };
  }

  private async getPendingOrThrow(id: string) {
    const row = await this.prisma.userSocialVerification.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Social verification request not found');
    }
    if (row.status !== SocialVerificationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending verification requests can be approved or rejected',
      );
    }
    return row;
  }

  private async assertStaff(adminId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (
      !admin ||
      (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPERADMIN)
    ) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private mapAdminListItem(row: {
    id: string;
    userId: string;
    platform: string;
    handle: string;
    profileUrl: string | null;
    submittedCode: string | null;
    status: SocialVerificationStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    adminComment: string | null;
    user?: {
      id: string;
      email: string;
      userType: string;
      profile: {
        firstName: string | null;
        lastName: string | null;
        socialMediaHandles: unknown;
      } | null;
    };
  }) {
    return {
      id: row.id,
      userId: row.userId,
      platform: row.platform,
      handle: row.handle,
      profileUrl: row.profileUrl,
      submittedCode: row.submittedCode,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      adminComment: row.adminComment,
      user: row.user,
    };
  }
}
