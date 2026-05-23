import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { VerifyNinDto } from './dto/verify-nin.dto';
import { LinkSocialDto } from './dto/link-social.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import {
  ApplicationStatus,
  ReferralStatus,
  VerificationStatus,
} from '@prisma/client';
import {
  assertLegalNameUpdatesAllowed,
  legalNamesLockUpdate,
} from '../common/utils/profile-legal-name.util';
import {
  assertHobbiesInterestsUpdateAllowed,
  assertSocialMediaHandlesUpdateAllowed,
  assertSocialMediaPartialUpdateAllowed,
} from '../common/utils/profile-field-cooldown.util';
import { SocialVerificationService } from './social-verification.service';

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  description?: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private socialVerificationService: SocialVerificationService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Profile retrieved successfully',
      data: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        reputationScore: user.reputationScore,
        ninVerified: user.ninVerified,
        socialVerificationCode: user.socialVerificationCode,
        profile: user.profile,
      },
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hobbiesChanged = assertHobbiesInterestsUpdateAllowed(
      user.profile,
      updateProfileDto.hobbiesInterests,
    );
    const socialChanged = assertSocialMediaHandlesUpdateAllowed(
      user.profile,
      updateProfileDto.socialMediaHandles,
    );

    const profileData: Record<string, unknown> = {
      employmentStatus: updateProfileDto.employmentStatus,
      state: updateProfileDto.state,
      city: updateProfileDto.city,
    };

    if (hobbiesChanged) {
      profileData.hobbiesInterests = updateProfileDto.hobbiesInterests;
      profileData.hobbiesInterestsUpdatedAt = new Date();
    }

    if (socialChanged) {
      profileData.socialMediaHandles = updateProfileDto.socialMediaHandles;
      profileData.socialMediaHandlesUpdatedAt = new Date();
    }

    Object.keys(profileData).forEach(
      (key) => profileData[key] === undefined && delete profileData[key],
    );

    if (Object.keys(profileData).length === 0) {
      throw new BadRequestException('No profile fields to update');
    }

    if (user.profile) {
      await this.prisma.userProfile.update({
        where: { userId },
        data: profileData,
      });
    } else {
      await this.prisma.userProfile.create({
        data: {
          userId,
          ...profileData,
        },
      });
    }

    // Check if profile is complete
    const updatedProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    const isComplete =
      updatedProfile?.firstName &&
      updatedProfile?.lastName &&
      updatedProfile?.age &&
      updatedProfile?.state &&
      updatedProfile?.city;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileComplete: !!isComplete },
    });

    return {
      message: 'Profile updated successfully',
      data: {
        profileComplete: isComplete || false,
      },
    };
  }

  async completeOnboarding(userId: string, onboardingDto: OnboardingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email first');
    }

    assertLegalNameUpdatesAllowed(
      user.profile,
      onboardingDto.firstName,
      onboardingDto.lastName,
    );

    const nameLockData = legalNamesLockUpdate(
      user.profile,
      onboardingDto.firstName,
      onboardingDto.lastName,
    );

    // Create or update profile
    const profileData = {
      firstName: onboardingDto.firstName,
      lastName: onboardingDto.lastName,
      age: onboardingDto.age,
      hobbiesInterests: onboardingDto.hobbiesInterests || [],
      employmentStatus: onboardingDto.employmentStatus,
      state: onboardingDto.state,
      city: onboardingDto.city,
      socialMediaHandles: onboardingDto.socialMediaHandles || {},
    };

    const now = new Date();
    const cooldownTimestamps: Record<string, Date> = {};
    if (profileData.hobbiesInterests?.length) {
      cooldownTimestamps.hobbiesInterestsUpdatedAt = now;
    }
    if (
      profileData.socialMediaHandles &&
      Object.keys(profileData.socialMediaHandles).length > 0
    ) {
      cooldownTimestamps.socialMediaHandlesUpdatedAt = now;
    }

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileData,
        ...nameLockData,
        ...cooldownTimestamps,
      },
      update: { ...profileData, ...nameLockData, ...cooldownTimestamps },
    });

    // Mark profile as complete
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileComplete: true },
    });

    return {
      message: 'Onboarding completed successfully',
      data: {
        profileComplete: true,
      },
    };
  }

  async verifyNIN(userId: string, verifyNinDto: VerifyNinDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Encrypt NIN number before storing
    const encryptedNIN = this.encryptionService.encrypt(verifyNinDto.ninNumber);

    // TODO: Integrate with NIN verification API
    // For now, we'll just mark as verified (manual verification)
    // In production, call NIN verification service

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ninNumber: encryptedNIN,
        ninVerified: true, // Set to false if API verification fails
      },
    });

    return {
      message: 'NIN verification submitted. Verification pending.',
      data: {
        ninVerified: true,
      },
    };
  }

  async linkSocialMedia(userId: string, linkSocialDto: LinkSocialDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentHandles = (user.profile?.socialMediaHandles as any) || {};
    const updatedHandles = {
      ...currentHandles,
      [linkSocialDto.platform]: linkSocialDto.handle,
    };

    assertSocialMediaPartialUpdateAllowed(user.profile);

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        socialMediaHandles: updatedHandles,
        socialMediaHandlesUpdatedAt: new Date(),
      },
      update: {
        socialMediaHandles: updatedHandles,
        socialMediaHandlesUpdatedAt: new Date(),
      },
    });

    await this.socialVerificationService.syncAfterLink(
      userId,
      linkSocialDto.platform,
      linkSocialDto.handle,
      linkSocialDto.profileUrl,
    );

    return {
      message: 'Social media account linked successfully',
      data: {
        platform: linkSocialDto.platform,
        handle: linkSocialDto.handle,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { verificationCode, connectedSocials } =
      await this.socialVerificationService.getConnectedSocials(userId);

    return {
      message: 'User information retrieved successfully',
      data: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        role: user.role,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        reputationScore: user.reputationScore,
        ninVerified: user.ninVerified,
        status: user.status,
        firstName: user.profile?.firstName || null,
        lastName: user.profile?.lastName || null,
        socialVerificationCode: verificationCode,
        connectedSocials,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Unified timeline for the current user: tasks, applications, submissions,
   * wallet, notifications, referrals.
   */
  async getRecentActivity(userId: string, query: RecentActivityQueryDto) {
    const limit = query.limit ?? 30;
    const fetchCap = Math.min(Math.max(limit * 4, limit), 120);

    const [
      createdTasks,
      applications,
      submissions,
      walletRows,
      notifications,
      referralsAsReferrer,
      referralsAsReferred,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: { creatorId: userId },
        orderBy: { createdAt: 'desc' },
        take: fetchCap,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
      this.prisma.taskApplication.findMany({
        where: { taskerId: userId },
        orderBy: { appliedAt: 'desc' },
        take: fetchCap,
        include: { task: { select: { id: true, title: true } } },
      }),
      this.prisma.taskSubmission.findMany({
        where: { taskerId: userId },
        orderBy: { createdAt: 'desc' },
        take: fetchCap,
        include: { task: { select: { id: true, title: true } } },
      }),
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: fetchCap,
        select: {
          id: true,
          transactionType: true,
          amount: true,
          transactionCategory: true,
          description: true,
          status: true,
          referenceId: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: 'desc' },
        take: fetchCap,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          data: true,
          createdAt: true,
        },
      }),
      this.prisma.referral.findMany({
        where: { referrerId: userId, status: ReferralStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        take: fetchCap,
        select: {
          id: true,
          referredId: true,
          rewardAmount: true,
          completedAt: true,
        },
      }),
      this.prisma.referral.findMany({
        where: { referredId: userId },
        orderBy: { createdAt: 'desc' },
        take: fetchCap,
        select: {
          id: true,
          referrerId: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const items: ActivityRow[] = [];

    for (const t of createdTasks) {
      items.push({
        id: `task_created:${t.id}`,
        type: 'TASK_CREATED',
        title: 'Task created',
        description: t.title,
        occurredAt: t.createdAt,
        metadata: { taskId: t.id, taskStatus: t.status },
      });
    }

    for (const a of applications) {
      items.push({
        id: `application_submitted:${a.id}`,
        type: 'APPLICATION_SUBMITTED',
        title: 'Application submitted',
        description: a.task.title,
        occurredAt: a.appliedAt,
        metadata: {
          applicationId: a.id,
          taskId: a.taskId,
          applicationStatus: a.status,
        },
      });
      if (a.approvedAt) {
        items.push({
          id: `application_approved:${a.id}`,
          type: 'APPLICATION_APPROVED',
          title: 'Application approved',
          description: a.task.title,
          occurredAt: a.approvedAt,
          metadata: { applicationId: a.id, taskId: a.taskId },
        });
      }
      if (a.status === ApplicationStatus.DECLINED) {
        items.push({
          id: `application_declined:${a.id}`,
          type: 'APPLICATION_DECLINED',
          title: 'Application declined',
          description: a.task.title,
          occurredAt: a.updatedAt,
          metadata: { applicationId: a.id, taskId: a.taskId },
        });
      }
      if (a.status === ApplicationStatus.COMPLETED && a.completedAt) {
        items.push({
          id: `application_completed:${a.id}`,
          type: 'APPLICATION_COMPLETED',
          title: 'Job completed',
          description: a.task.title,
          occurredAt: a.completedAt,
          metadata: { applicationId: a.id, taskId: a.taskId },
        });
      }
    }

    for (const s of submissions) {
      items.push({
        id: `submission_submitted:${s.id}`,
        type: 'SUBMISSION_SUBMITTED',
        title: 'Proof submitted',
        description: s.task.title,
        occurredAt: s.createdAt,
        metadata: {
          submissionId: s.id,
          taskId: s.taskId,
          proofType: this.primaryProofType(s.proofs),
          verificationStatus: s.verificationStatus,
        },
      });
      if (s.verificationStatus === VerificationStatus.VERIFIED && s.verifiedAt) {
        items.push({
          id: `submission_verified:${s.id}`,
          type: 'SUBMISSION_VERIFIED',
          title: 'Submission verified',
          description: s.task.title,
          occurredAt: s.verifiedAt,
          metadata: { submissionId: s.id, taskId: s.taskId },
        });
      }
      if (s.verificationStatus === VerificationStatus.REJECTED && s.rejectedAt) {
        items.push({
          id: `submission_rejected:${s.id}`,
          type: 'SUBMISSION_REJECTED',
          title: 'Submission rejected',
          description: s.task.title,
          occurredAt: s.rejectedAt,
          metadata: {
            submissionId: s.id,
            taskId: s.taskId,
            adminComment: s.adminComment ?? null,
          },
        });
      }
    }

    for (const w of walletRows) {
      items.push({
        id: `wallet:${w.id}`,
        type: 'WALLET_TRANSACTION',
        title:
          w.transactionType === 'CREDIT' ? 'Wallet credit' : 'Wallet debit',
        description: w.description,
        occurredAt: w.createdAt,
        metadata: {
          transactionId: w.id,
          transactionType: w.transactionType,
          category: w.transactionCategory,
          amount: Number(w.amount),
          status: w.status,
          referenceId: w.referenceId,
        },
      });
    }

    for (const n of notifications) {
      items.push({
        id: `notification:${n.id}`,
        type: 'NOTIFICATION',
        title: n.title,
        description: n.message,
        occurredAt: n.createdAt,
        metadata: {
          notificationId: n.id,
          notificationType: n.type,
          read: n.read,
          data: n.data ?? null,
        },
      });
    }

    for (const r of referralsAsReferrer) {
      if (r.completedAt) {
        items.push({
          id: `referral_reward:${r.id}`,
          type: 'REFERRAL_REWARD',
          title: 'Referral reward',
          description: `Reward for referring a user`,
          occurredAt: r.completedAt,
          metadata: {
            referralId: r.id,
            referredUserId: r.referredId,
            rewardAmount: Number(r.rewardAmount),
          },
        });
      }
    }

    for (const r of referralsAsReferred) {
      items.push({
        id: `referral_joined:${r.id}`,
        type: 'REFERRAL_JOINED',
        title: 'Joined via referral',
        description:
          r.status === ReferralStatus.COMPLETED
            ? 'Referral completed'
            : 'Referral pending',
        occurredAt: r.completedAt ?? r.createdAt,
        metadata: {
          referralId: r.id,
          referrerId: r.referrerId,
          status: r.status,
        },
      });
    }

    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const sliced = items.slice(0, limit);

    return {
      message: 'Recent activity retrieved successfully',
      data: {
        items: sliced.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          description: row.description,
          occurredAt: row.occurredAt.toISOString(),
          metadata: row.metadata,
        })),
        limit,
      },
    };
  }

  private primaryProofType(proofs: unknown): string | undefined {
    const arr = proofs as Array<{ proofType?: string }> | undefined;
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    const t = arr[0]?.proofType;
    return typeof t === 'string' ? t : undefined;
  }
}

