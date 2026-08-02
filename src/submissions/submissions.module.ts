import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { AIService } from '../common/services/ai.service';
import { WalletModule } from '../wallet/wallet.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  controllers: [SubmissionsController],
  providers: [SubmissionsService, AIService],
  imports: [WalletModule, ReputationModule],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}

