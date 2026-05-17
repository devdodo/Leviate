import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminSubmissionsController } from './admin-submissions.controller';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [SubmissionsModule],
  controllers: [AdminController, AdminSubmissionsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

