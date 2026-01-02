import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        this.logger.error(
          `❌ Database connection failed: ${error.message}\n` +
          `Please ensure:\n` +
          `1. PostgreSQL is running on the configured host/port\n` +
          `2. DATABASE_URL is set correctly in your .env file\n` +
          `3. Database "elevare" exists\n` +
          `4. User has proper permissions\n\n` +
          `Example DATABASE_URL: postgresql://user:password@localhost:5432/elevare`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`Database connection error: ${error.message}`);
      } else {
        this.logger.error(`Database connection error: ${String(error)}`);
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}

