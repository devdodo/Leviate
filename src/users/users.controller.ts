import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserTypesGuard } from '../common/guards/user-types.guard';
import { UserTypes } from '../common/decorators/user-types.decorator';
import { UserType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { VerifyNinDto } from './dto/verify-nin.dto';
import { LinkSocialDto } from './dto/link-social.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { TransactionQueryDto } from '../wallet/dto/transaction-query.dto';
import { WalletService } from '../wallet/wallet.service';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { SocialVerificationService } from './social-verification.service';
import { SubmitSocialVerificationDto } from './dto/submit-social-verification.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, UserTypesGuard)
@UserTypes(UserType.CREATOR, UserType.CONTRIBUTOR)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly socialVerificationService: SocialVerificationService,
    private readonly walletService: WalletService,
  ) {}

  @Get('me/transactions')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description:
      'Paginated wallet transactions for the current user. Optional filters: type, category, status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: BaseResponseDto,
  })
  async getMyTransactions(
    @CurrentUser() user: { id: string },
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }

  @Get('me/recent-activity')
  @ApiOperation({
    summary: 'Recent activity for the current user',
    description:
      'Merged timeline: tasks you created, applications, submissions, wallet movements, notifications, referrals. Sorted newest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity items retrieved successfully',
    type: BaseResponseDto,
  })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query() query: RecentActivityQueryDto,
  ) {
    return this.usersService.getRecentActivity(user.id, query);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user information',
    description:
      'Includes connectedSocials: platform, handle, and isApproved per linked account.',
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    type: BaseResponseDto,
  })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.getMe(user.id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: BaseResponseDto,
  })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Updates employment, location, hobbies (30-day cooldown after first set), and social handles (90-day cooldown). Legal name and age are set via onboarding only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: BaseResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Post('onboarding')
  @ApiOperation({
    summary: 'Complete onboarding process',
    description:
      'Creators may pass isBusiness (boolean) and businessName (required when isBusiness is true) to distinguish businesses from individuals.',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed successfully',
    type: BaseResponseDto,
  })
  async completeOnboarding(
    @CurrentUser() user: any,
    @Body() onboardingDto: OnboardingDto,
  ) {
    return this.usersService.completeOnboarding(user.id, onboardingDto);
  }

  @Post('verify-nin')
  @ApiOperation({ summary: 'Verify NIN (National Identification Number)' })
  @ApiResponse({
    status: 200,
    description: 'NIN verification submitted',
    type: BaseResponseDto,
  })
  async verifyNIN(
    @CurrentUser() user: any,
    @Body() verifyNinDto: VerifyNinDto,
  ) {
    return this.usersService.verifyNIN(user.id, verifyNinDto);
  }

  @Post('link-social')
  @ApiOperation({ summary: 'Link social media account' })
  @ApiResponse({
    status: 200,
    description: 'Social media account linked successfully',
    type: BaseResponseDto,
  })
  async linkSocialMedia(
    @CurrentUser() user: any,
    @Body() linkSocialDto: LinkSocialDto,
  ) {
    return this.usersService.linkSocialMedia(user.id, linkSocialDto);
  }

  @Get('social-verification/instructions')
  @ApiOperation({
    summary: 'Get verification code and instructions',
    description:
      'Returns the code users must add to their public bio before submitting for manual review.',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  getSocialVerificationInstructions(@CurrentUser() user: { id: string }) {
    return this.socialVerificationService.getInstructions(user.id);
  }

  @Get('social-verification/status')
  @ApiOperation({
    summary: 'Per-platform social verification status',
    description:
      'NOT_LINKED | AWAITING_SUBMISSION | PENDING | VERIFIED | REJECTED for each platform.',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  getSocialVerificationStatus(@CurrentUser() user: { id: string }) {
    return this.socialVerificationService.getMyPlatformStatuses(user.id);
  }

  @Post('social-verification/submit')
  @ApiOperation({
    summary: 'Submit verification code for manual review',
    description:
      'After adding the code from instructions to your public bio, submit it here for admin verification.',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  submitSocialVerification(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitSocialVerificationDto,
  ) {
    return this.socialVerificationService.submitVerification(user.id, dto);
  }
}

