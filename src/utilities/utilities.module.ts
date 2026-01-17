import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { UtilitiesController } from './utilities.controller';
import { AdminUtilitiesController } from './admin-utilities.controller';

@Module({
  controllers: [UtilitiesController, AdminUtilitiesController],
  providers: [UtilitiesService],
  exports: [UtilitiesService],
})
export class UtilitiesModule {}

