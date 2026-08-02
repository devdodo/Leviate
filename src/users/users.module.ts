import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EncryptionService } from '../common/services/encryption.service';
import { SocialVerificationService } from './social-verification.service';
import { EmailService } from '../common/services/email.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [UsersController],
  providers: [UsersService, SocialVerificationService, EncryptionService, EmailService],
  exports: [UsersService, SocialVerificationService],
})
export class UsersModule {}

