import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SocialVerificationService } from '../users/social-verification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { ListSocialVerificationsQueryDto } from './dto/list-social-verifications-query.dto';
import {
  ReviewSocialVerificationDto,
  RejectSocialVerificationDto,
} from './dto/review-social-verification.dto';

@ApiTags('Admin - Social verification')
@Controller('admin/social-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminSocialVerificationsController {
  constructor(
    private readonly socialVerificationService: SocialVerificationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List social profile verification requests',
    description: 'Default queue: PENDING (user submitted verification code).',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async list(@Query() query: ListSocialVerificationsQueryDto) {
    return this.socialVerificationService.listForAdmin(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'All platform verification statuses for a user',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async getByUser(@Param('userId') userId: string) {
    return this.socialVerificationService.getByUserIdForAdmin(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one verification request (review detail)' })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async getOne(@Param('id') id: string) {
    return this.socialVerificationService.getByIdForAdmin(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve social verification (manual check completed)',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async approve(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() body: ReviewSocialVerificationDto,
  ) {
    return this.socialVerificationService.approve(admin.id, id, body.comment);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject social verification' })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async reject(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() body: RejectSocialVerificationDto,
  ) {
    return this.socialVerificationService.reject(admin.id, id, body.comment);
  }
}
