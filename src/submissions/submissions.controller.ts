import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
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
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Override verification (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Verification overridden successfully',
    type: BaseResponseDto,
  })
  async overrideVerification(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { verified: boolean },
  ) {
    return this.submissionsService.overrideVerification(id, body.verified, user.id);
  }
}

