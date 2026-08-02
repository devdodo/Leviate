import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { ReputationModule } from './reputation/reputation.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { BanksModule } from './banks/banks.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { UploadsModule } from './uploads/uploads.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './common/prisma.module';
import { EmailService } from './common/services/email.service';
import { PaystackService } from './common/services/paystack.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: parseInt(configService.get<string>('THROTTLER_TTL') || '60000', 10),
          limit: parseInt(configService.get<string>('THROTTLER_LIMIT') || '100', 10),
        },
      ],
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const port = parseInt(
          configService.get<string>('SMTP_PORT', '465'),
          10,
        );
        // secure=true for implicit TLS (465); false for STARTTLS (587).
        const secure =
          configService.get<string>('SMTP_SECURE', 'true') === 'true';
        const user = configService.get<string>('SMTP_USER');
        const fromEmail = configService.get<string>('FROM_EMAIL') || user;
        const fromName = configService.get<string>('FROM_NAME') || 'Leviate';
        return {
          transport: {
            host: configService.get<string>(
              'SMTP_HOST',
              'mail.privateemail.com',
            ),
            port,
            secure,
            auth: {
              user,
              pass: configService.get<string>('SMTP_PASSWORD'),
            },
          },
          defaults: {
            from: `"${fromName}" <${fromEmail}>`,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    ReputationModule,
    RecommendationsModule,
    UsersModule,
    TasksModule,
    SubmissionsModule,
    WalletModule,
    NotificationsModule,
    ReferralsModule,
    ReportsModule,
    AdminModule,
    BanksModule,
    UtilitiesModule,
    UploadsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EmailService,
    PaystackService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
