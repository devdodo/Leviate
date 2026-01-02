const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying withdrawal OTP table migration...\n');

    // Step 1: Create withdrawal_otps table
    console.log('Creating withdrawal_otps table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "withdrawal_otps" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "otp" VARCHAR(10) NOT NULL,
        "expires_at" TIMESTAMPTZ(6) NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL,
        CONSTRAINT "withdrawal_otps_pkey" PRIMARY KEY ("id")
      );
    `);

    // Step 2: Create indexes
    console.log('Creating indexes...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "withdrawal_otps_user_id_idx" ON "withdrawal_otps"("user_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "withdrawal_otps_used_idx" ON "withdrawal_otps"("used");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "withdrawal_otps_expires_at_idx" ON "withdrawal_otps"("expires_at");
    `);

    // Step 3: Add foreign key
    console.log('Adding foreign key constraint...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_otps_user_id_fkey'
        ) THEN
          ALTER TABLE "withdrawal_otps" 
          ADD CONSTRAINT "withdrawal_otps_user_id_fkey" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // Step 4: Migrate existing data
    console.log('Migrating existing withdrawal OTP data...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      DECLARE
        user_record RECORD;
      BEGIN
        FOR user_record IN 
          SELECT id, withdrawal_otp, withdrawal_otp_expires_at 
          FROM users 
          WHERE withdrawal_otp IS NOT NULL AND withdrawal_otp_expires_at IS NOT NULL
        LOOP
          INSERT INTO "withdrawal_otps" (id, user_id, otp, expires_at, used, created_at, updated_at)
          VALUES (
            gen_random_uuid()::text,
            user_record.id,
            user_record.withdrawal_otp,
            user_record.withdrawal_otp_expires_at,
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT DO NOTHING;
        END LOOP;
      END $$;
    `);

    // Step 5: Remove columns from users table
    console.log('Removing withdrawal OTP columns from users table...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'withdrawal_otp'
        ) THEN
          ALTER TABLE "users" DROP COLUMN "withdrawal_otp";
        END IF;
        
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'withdrawal_otp_expires_at'
        ) THEN
          ALTER TABLE "users" DROP COLUMN "withdrawal_otp_expires_at";
        END IF;
      END $$;
    `);

    console.log('\n✅ Migration applied successfully!\n');
    console.log('Created:');
    console.log('  - withdrawal_otps table');
    console.log('  - Migrated existing OTP data (if any)');
    console.log('  - Removed withdrawal_otp columns from users table\n');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

