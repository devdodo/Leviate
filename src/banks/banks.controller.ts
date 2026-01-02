import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BanksService } from './banks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddBankDto } from './dto/add-bank.dto';
import { VerifyWithdrawalOtpDto } from './dto/verify-withdrawal-otp.dto';
import { WithdrawDto } from '../wallet/dto/withdraw.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Banks')
@Controller('banks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get('list')
  @ApiOperation({ summary: 'Get list of banks from Paystack' })
  @ApiResponse({
    status: 200,
    description: 'Banks retrieved successfully',
    type: BaseResponseDto,
  })
  async getBankList() {
    return this.banksService.listBanks();
  }

  @Post()
  @ApiOperation({ summary: 'Add and verify bank account' })
  @ApiResponse({
    status: 201,
    description: 'Bank account added and verified successfully',
    type: BaseResponseDto,
  })
  async addBankAccount(
    @CurrentUser() user: any,
    @Body() addBankDto: AddBankDto,
  ) {
    return this.banksService.addBankAccount(user.id, addBankDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my bank accounts' })
  @ApiResponse({
    status: 200,
    description: 'Bank accounts retrieved successfully',
    type: BaseResponseDto,
  })
  async getMyBankAccounts(@CurrentUser() user: any) {
    return this.banksService.getBankAccounts(user.id);
  }

  @Put(':id/set-default')
  @ApiOperation({ summary: 'Set default bank account' })
  @ApiResponse({
    status: 200,
    description: 'Default bank account updated successfully',
    type: BaseResponseDto,
  })
  async setDefaultBankAccount(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.banksService.setDefaultBankAccount(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete bank account' })
  @ApiResponse({
    status: 200,
    description: 'Bank account deleted successfully',
    type: BaseResponseDto,
  })
  async deleteBankAccount(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.banksService.deleteBankAccount(user.id, id);
  }

  @Post('withdrawal/request-otp')
  @ApiOperation({ summary: 'Request withdrawal OTP' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal OTP sent to email',
    type: BaseResponseDto,
  })
  async requestWithdrawalOtp(
    @CurrentUser() user: any,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.banksService.requestWithdrawalOtp(user.id, withdrawDto);
  }

  @Post('withdrawal/verify-otp')
  @ApiOperation({ summary: 'Verify withdrawal OTP and process withdrawal' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal processed successfully',
    type: BaseResponseDto,
  })
  async verifyWithdrawalOtp(
    @CurrentUser() user: any,
    @Body() body: VerifyWithdrawalOtpDto & WithdrawDto,
  ) {
    const { otp, bankAccountId, ...withdrawDto } = body;
    return this.banksService.verifyWithdrawalOtp(
      user.id,
      { otp, bankAccountId },
      withdrawDto,
    );
  }
}

