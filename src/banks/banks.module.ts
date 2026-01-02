import { Module } from '@nestjs/common';
import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';
import { PaystackService } from '../common/services/paystack.service';
import { EmailService } from '../common/services/email.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  controllers: [BanksController],
  providers: [BanksService, PaystackService, EmailService],
  imports: [WalletModule],
  exports: [BanksService],
})
export class BanksModule {}

