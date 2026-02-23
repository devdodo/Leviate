import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AIService } from '../common/services/ai.service';
import { PaystackService } from '../common/services/paystack.service';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AIService, PaystackService],
  imports: [ReputationModule],
  exports: [TasksService],
})
export class TasksModule {}

