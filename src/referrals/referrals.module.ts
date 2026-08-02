import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { EmailService } from '../common/services/email.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, EmailService],
  imports: [WalletModule],
  exports: [ReferralsService],
})
export class ReferralsModule {}

