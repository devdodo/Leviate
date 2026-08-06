import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { ImageKitService } from '../common/services/imagekit.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [UploadsService, ImageKitService],
  exports: [UploadsService],
})
export class UploadsModule {}
