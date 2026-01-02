-- Add withdrawal OTP fields to users table
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

-- Create bank_accounts table
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

-- Create unique constraint on account_number
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_account_number_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_account_number_key" ON "bank_accounts"("account_number");
    END IF;
END $$;

-- Create unique constraint on paystack_recipient_code (if not null)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_paystack_recipient_code_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_paystack_recipient_code_key" 
        ON "bank_accounts"("paystack_recipient_code") 
        WHERE "paystack_recipient_code" IS NOT NULL;
    END IF;
END $$;

-- Create unique constraint on user_id and account_number combination
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'bank_accounts_user_id_account_number_key'
    ) THEN
        CREATE UNIQUE INDEX "bank_accounts_user_id_account_number_key" 
        ON "bank_accounts"("user_id", "account_number");
    END IF;
END $$;

-- Create indexes
DO $$ 
BEGIN
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
END $$;

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_user_id_fkey'
    ) THEN
        ALTER TABLE "bank_accounts" 
        ADD CONSTRAINT "bank_accounts_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

