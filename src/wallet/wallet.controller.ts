import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BaseResponseDto,
  })
  async getBalance(@CurrentUser() user: any) {
    return this.walletService.getBalance(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: BaseResponseDto,
  })
  async getTransactions(
    @CurrentUser() user: any,
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get detailed ledger entries' })
  @ApiResponse({
    status: 200,
    description: 'Ledger entries retrieved successfully',
    type: BaseResponseDto,
  })
  async getLedger(
    @CurrentUser() user: any,
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getLedger(user.id, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get wallet statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: BaseResponseDto,
  })
  async getStatistics(@CurrentUser() user: any) {
    return this.walletService.getStatistics(user.id);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request withdrawal' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request submitted successfully',
    type: BaseResponseDto,
  })
  async withdraw(
    @CurrentUser() user: any,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.walletService.withdraw(user.id, withdrawDto);
  }
}

