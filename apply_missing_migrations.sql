-- Apply missing migrations manually
-- This adds the withdrawal_otp fields and bank_accounts table

-- Step 1: Add withdrawal OTP fields to users table (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'withdrawal_otp'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "withdrawal_otp" VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'withdrawal_otp_expires_at'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "withdrawal_otp_expires_at" TIMESTAMPTZ(6);
    END IF;
END $$;

-- Step 2: Create bank_accounts table (if it doesn't exist)
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

-- Step 3: Create indexes and constraints (if they don't exist)
DO $$ 
BEGIN
    -- Unique constraint on account_number
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_account_number_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_account_number_key" ON "bank_accounts"("account_number");
    END IF;
    
    -- Unique constraint on paystack_recipient_code (partial index for non-null values)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_paystack_recipient_code_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_paystack_recipient_code_key" 
        ON "bank_accounts"("paystack_recipient_code") 
        WHERE "paystack_recipient_code" IS NOT NULL;
    END IF;
    
    -- Unique constraint on user_id and account_number
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_user_id_account_number_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_user_id_account_number_key" 
        ON "bank_accounts"("user_id", "account_number");
    END IF;
    
    -- Index on user_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_user_id_idx'
    ) THEN
        CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");
    END IF;
    
    -- Index on is_verified
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_is_verified_idx'
    ) THEN
        CREATE INDEX "bank_accounts_is_verified_idx" ON "bank_accounts"("is_verified");
    END IF;
    
    -- Foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_user_id_fkey'
    ) THEN
        ALTER TABLE "bank_accounts" 
        ADD CONSTRAINT "bank_accounts_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

