import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AIService } from '../common/services/ai.service';
import { PaystackService } from '../common/services/paystack.service';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationModule } from '../reputation/reputation.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AIService, PaystackService],
  imports: [ReputationModule, WalletModule],
  exports: [TasksService],
})
export class TasksModule {}

