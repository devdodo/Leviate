import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task submission' })
  @ApiResponse({
    status: 201,
    description: 'Submission created successfully',
    type: BaseResponseDto,
  })
  async createSubmission(
    @CurrentUser() user: any,
    @Body() createSubmissionDto: CreateSubmissionDto,
  ) {
    return this.submissionsService.createSubmission(user.id, createSubmissionDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission by ID' })
  @ApiResponse({
    status: 200,
    description: 'Submission retrieved successfully',
    type: BaseResponseDto,
  })
  async getSubmission(@CurrentUser() user: any, @Param('id') id: string) {
    return this.submissionsService.getSubmission(id, user.id);
  }

  @Post(':id/verify')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Verify submission as complete (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Submission verified successfully',
    type: BaseResponseDto,
  })
  async verifySubmission(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { comment?: string },
  ) {
    return this.submissionsService.verifySubmission(id, user.id, body.comment);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Reject submission with feedback (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Submission rejected successfully',
    type: BaseResponseDto,
  })
  async rejectSubmission(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { comment: string },
  ) {
    return this.submissionsService.rejectSubmission(id, user.id, body.comment);
  }

  @Get('pending/review')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Get all pending submissions for admin review' })
  @ApiResponse({
    status: 200,
    description: 'Pending submissions retrieved successfully',
    type: BaseResponseDto,
  })
  async getPendingSubmissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissionsService.getPendingSubmissions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}

