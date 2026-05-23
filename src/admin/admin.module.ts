import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminSubmissionsController } from './admin-submissions.controller';
import { AdminSocialVerificationsController } from './admin-social-verifications.controller';
import { SubmissionsModule } from '../submissions/submissions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SubmissionsModule, UsersModule],
  controllers: [
    AdminController,
    AdminSubmissionsController,
    AdminSocialVerificationsController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

