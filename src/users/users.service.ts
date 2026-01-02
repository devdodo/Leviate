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

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
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

    // Update or create profile
    const profileData: any = {
      firstName: updateProfileDto.firstName,
      lastName: updateProfileDto.lastName,
      age: updateProfileDto.age,
      hobbiesInterests: updateProfileDto.hobbiesInterests,
      employmentStatus: updateProfileDto.employmentStatus,
      state: updateProfileDto.state,
      city: updateProfileDto.city,
      socialMediaHandles: updateProfileDto.socialMediaHandles,
    };

    // Remove undefined values
    Object.keys(profileData).forEach(
      (key) => profileData[key] === undefined && delete profileData[key],
    );

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
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email first');
    }

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

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileData,
      },
      update: profileData,
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

    // Update profile with new social media handle
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        socialMediaHandles: updatedHandles,
      },
      update: {
        socialMediaHandles: updatedHandles,
      },
    });

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

    return {
      message: 'User information retrieved successfully',
      data: user,
    };
  }
}

