import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService],
  imports: [WalletModule],
  exports: [ReferralsService],
})
export class ReferralsModule {}

