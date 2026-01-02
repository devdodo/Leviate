import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Reputation')
@Controller('reputation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('score')
  @ApiOperation({ summary: 'Get current user reputation score' })
  @ApiResponse({
    status: 200,
    description: 'Reputation score retrieved successfully',
    type: BaseResponseDto,
  })
  async getMyReputation(@CurrentUser() user: any) {
    const score = await this.reputationService.getReputationScore(user.id);
    const tier = this.reputationService.getReputationTier(score);

    return {
      message: 'Reputation score retrieved successfully',
      data: {
        score,
        tier,
        minScore: 0,
        maxScore: 100,
      },
    };
  }

  @Get('score/:userId')
  @ApiOperation({ summary: 'Get reputation score for a user' })
  @ApiResponse({
    status: 200,
    description: 'Reputation score retrieved successfully',
    type: BaseResponseDto,
  })
  async getUserReputation(@Param('userId') userId: string) {
    const score = await this.reputationService.getReputationScore(userId);
    const tier = this.reputationService.getReputationTier(score);

    return {
      message: 'Reputation score retrieved successfully',
      data: {
        userId,
        score,
        tier,
      },
    };
  }
}

