-- AlterEnum
-- This migration updates UserType enum from CREATOR/TASKER to CREATOR/CONTRIBUTOR
-- and UserRole enum from USER/ADMIN to USER/ADMIN/SUPERADMIN

-- Step 1: Add CONTRIBUTOR to UserType enum (must be done first, before using it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CONTRIBUTOR' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserType')
    ) THEN
        ALTER TYPE "UserType" ADD VALUE 'CONTRIBUTOR';
    END IF;
END $$;

-- Step 2: Add SUPERADMIN to UserRole enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SUPERADMIN' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
    ) THEN
        ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';
    END IF;
END $$;

-- Step 3: Update existing TASKER records to CONTRIBUTOR
-- Note: This must be done in a separate statement after the enum value is added
UPDATE "users" SET "user_type" = 'CONTRIBUTOR'::"UserType" WHERE "user_type" = 'TASKER'::"UserType";

