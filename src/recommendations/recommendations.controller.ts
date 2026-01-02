import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('taskers/:taskId')
  @ApiOperation({ summary: 'Get recommended contributors for a task' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Recommended taskers retrieved successfully',
    type: BaseResponseDto,
  })
  async getRecommendedTaskers(
    @Param('taskId') taskId: string,
    @Query('limit') limit?: number,
  ) {
    const taskers = await this.recommendationsService.getRecommendedTaskers(
      taskId,
      limit || 10,
    );

    return {
      message: 'Recommended taskers retrieved successfully',
      data: {
        taskId,
        taskers,
        count: taskers.length,
      },
    };
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get recommended tasks for current contributor' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Recommended tasks retrieved successfully',
    type: BaseResponseDto,
  })
  async getRecommendedTasks(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    const tasks = await this.recommendationsService.getRecommendedTasksForTasker(
      user.id,
      limit || 10,
    );

    return {
      message: 'Recommended tasks retrieved successfully',
      data: {
        tasks,
        count: tasks.length,
      },
    };
  }

  @Get('top-contributors')
  @ApiOperation({ summary: 'Get top contributors by reputation' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Top contributors retrieved successfully',
    type: BaseResponseDto,
  })
  async getTopContributors(@Query('limit') limit?: number) {
    const contributors = await this.recommendationsService.getTopContributors(
      limit || 20,
    );

    return {
      message: 'Top contributors retrieved successfully',
      data: {
        contributors,
        count: contributors.length,
      },
    };
  }
}

