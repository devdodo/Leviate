import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { WithdrawDto } from '../wallet/dto/withdraw.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('code')
  @ApiOperation({ summary: 'Get my referral code' })
  @ApiResponse({
    status: 200,
    description: 'Referral code retrieved successfully',
    type: BaseResponseDto,
  })
  async getReferralCode(@CurrentUser() user: any) {
    return this.referralsService.getReferralCode(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get referral history' })
  @ApiResponse({
    status: 200,
    description: 'Referral history retrieved successfully',
    type: BaseResponseDto,
  })
  async getReferralHistory(@CurrentUser() user: any) {
    return this.referralsService.getReferralHistory(user.id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get referral earnings balance' })
  @ApiResponse({
    status: 200,
    description: 'Referral balance retrieved successfully',
    type: BaseResponseDto,
  })
  async getReferralBalance(@CurrentUser() user: any) {
    return this.referralsService.getReferralBalance(user.id);
  }

  @Post('apply-code')
  @ApiOperation({ summary: 'Apply referral code' })
  @ApiResponse({
    status: 200,
    description: 'Referral code applied successfully',
    type: BaseResponseDto,
  })
  async applyReferralCode(
    @CurrentUser() user: any,
    @Body() applyReferralDto: ApplyReferralDto,
  ) {
    return this.referralsService.applyReferralCode(user.id, applyReferralDto.referralCode);
  }

  @Post('withdraw-to-wallet')
  @ApiOperation({ summary: 'Withdraw from referral earnings to main wallet' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal from referral earnings processed successfully',
    type: BaseResponseDto,
  })
  async withdrawFromReferral(
    @CurrentUser() user: any,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.referralsService.withdrawFromReferral(user.id, withdrawDto);
  }
}

