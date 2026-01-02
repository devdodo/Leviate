import {
  Controller,
  Get,
  Put,
  Post,
  Body,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { VerifyNinDto } from './dto/verify-nin.dto';
import { LinkSocialDto } from './dto/link-social.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user information' })
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
  @ApiOperation({ summary: 'Update user profile' })
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
  @ApiOperation({ summary: 'Complete onboarding process' })
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
}

