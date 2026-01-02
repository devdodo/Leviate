-- Create withdrawal_otps table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS "withdrawal_otps_user_id_idx" ON "withdrawal_otps"("user_id");
CREATE INDEX IF NOT EXISTS "withdrawal_otps_used_idx" ON "withdrawal_otps"("used");
CREATE INDEX IF NOT EXISTS "withdrawal_otps_expires_at_idx" ON "withdrawal_otps"("expires_at");

-- Add foreign key constraint
ALTER TABLE "withdrawal_otps" ADD CONSTRAINT "withdrawal_otps_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing withdrawal OTP data from users table (if any)
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

-- Remove withdrawal OTP columns from users table
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

