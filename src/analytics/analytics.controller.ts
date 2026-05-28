import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserTypesGuard } from '../common/guards/user-types.guard';
import { UserTypes } from '../common/decorators/user-types.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import {
  CreatorAnalyticsPeriod,
  CreatorDashboardAnalyticsQueryDto,
} from './dto/creator-dashboard-analytics-query.dto';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, UserTypesGuard)
@UserTypes(UserType.CREATOR)
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('creator/dashboard')
  @ApiOperation({
    summary: 'Creator dashboard analytics',
    description:
      'Returns task completion time series, total tasks created (with period-over-period change), total participants, and total campaign spend. Does not include wallet balance.',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  @ApiResponse({ status: 403, description: 'Creators only' })
  async getCreatorDashboard(
    @CurrentUser() user: { id: string; userType: UserType },
    @Query() query: CreatorDashboardAnalyticsQueryDto,
  ) {
    return this.analyticsService.getCreatorDashboard(
      user.id,
      user.userType,
      query.period ?? CreatorAnalyticsPeriod.WEEK,
    );
  }
}
