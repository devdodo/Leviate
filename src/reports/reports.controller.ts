import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tasks')
  @ApiOperation({ summary: 'Get tasks report (for creators)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks report retrieved successfully',
    type: BaseResponseDto,
  })
  async getTasksReport(@CurrentUser() user: any) {
    return this.reportsService.getTasksReport(user.id);
  }

  @Get('tasks/:id/details')
  @ApiOperation({ summary: 'Get detailed task report' })
  @ApiResponse({
    status: 200,
    description: 'Task details retrieved successfully',
    type: BaseResponseDto,
  })
  async getTaskDetails(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.reportsService.getTaskDetails(user.id, id);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
    type: BaseResponseDto,
  })
  async getPerformanceMetrics(@CurrentUser() user: any) {
    return this.reportsService.getPerformanceMetrics(user.id);
  }
}

