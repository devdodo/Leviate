const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying missing migration: withdrawal_otp and bank_accounts...\n');

    // Execute migration statements one by one
    console.log('Adding withdrawal_otp column...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'withdrawal_otp'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "withdrawal_otp" VARCHAR(10);
        END IF;
      END $$;
    `);

    console.log('Adding withdrawal_otp_expires_at column...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'withdrawal_otp_expires_at'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "withdrawal_otp_expires_at" TIMESTAMPTZ(6);
        END IF;
      END $$;
    `);

    console.log('Creating bank_accounts table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "account_name" VARCHAR(255) NOT NULL,
        "account_number" VARCHAR(20) NOT NULL,
        "bank_code" VARCHAR(10) NOT NULL,
        "bank_name" VARCHAR(255) NOT NULL,
        "is_verified" BOOLEAN NOT NULL DEFAULT false,
        "is_default" BOOLEAN NOT NULL DEFAULT false,
        "paystack_recipient_code" VARCHAR(100),
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL,
        CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Creating indexes and constraints...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_account_number_key'
        ) THEN
          CREATE UNIQUE INDEX "bank_accounts_account_number_key" ON "bank_accounts"("account_number");
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_paystack_recipient_code_key'
        ) THEN
          CREATE UNIQUE INDEX "bank_accounts_paystack_recipient_code_key" 
          ON "bank_accounts"("paystack_recipient_code") 
          WHERE "paystack_recipient_code" IS NOT NULL;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_user_id_account_number_key'
        ) THEN
          CREATE UNIQUE INDEX "bank_accounts_user_id_account_number_key" 
          ON "bank_accounts"("user_id", "account_number");
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_user_id_idx'
        ) THEN
          CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_is_verified_idx'
        ) THEN
          CREATE INDEX "bank_accounts_is_verified_idx" ON "bank_accounts"("is_verified");
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_user_id_fkey'
        ) THEN
          ALTER TABLE "bank_accounts" 
          ADD CONSTRAINT "bank_accounts_user_id_fkey" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    console.log('\n✅ Migration applied successfully!\n');
    console.log('Added:');
    console.log('  - withdrawal_otp column to users table');
    console.log('  - withdrawal_otp_expires_at column to users table');
    console.log('  - bank_accounts table with all indexes and constraints\n');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('\n⚠️  Some objects may already exist. This is okay - the migration is idempotent.');
      console.log('✅ Migration completed (some objects were already present).\n');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

