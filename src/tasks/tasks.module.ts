import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AIService } from '../common/services/ai.service';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AIService],
  imports: [ReputationModule],
  exports: [TasksService],
})
export class TasksModule {}

