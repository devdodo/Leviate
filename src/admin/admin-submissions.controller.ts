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
import { SubmissionsService } from '../submissions/submissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { ReviewSubmissionsQueryDto } from '../submissions/dto/review-submissions-query.dto';
import { ApproveSubmissionDto } from './dto/approve-submission.dto';
import { RejectSubmissionDto } from './dto/reject-submission.dto';

@ApiTags('Admin - Submissions')
@Controller('admin/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List submissions for staff review',
    description:
      'Default: PENDING submissions (contributor completed work, awaiting approval). Use `status` to filter VERIFIED or REJECTED.',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async listForReview(@Query() query: ReviewSubmissionsQueryDto) {
    return this.submissionsService.listSubmissionsForReview(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission detail for review' })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async getForReview(@Param('id') id: string) {
    return this.submissionsService.getSubmissionForReview(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve submission and release payout to contributor wallet',
  })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async approve(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: ApproveSubmissionDto,
  ) {
    return this.submissionsService.verifySubmission(id, user.id, body.comment);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject submission (no payout; contributor may resubmit)' })
  @ApiResponse({ status: 200, type: BaseResponseDto })
  async reject(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: RejectSubmissionDto,
  ) {
    return this.submissionsService.rejectSubmission(id, user.id, body.comment);
  }
}
