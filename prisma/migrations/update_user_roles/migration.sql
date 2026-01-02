-- AlterEnum
-- This migration updates UserType enum from CREATOR/TASKER to CREATOR/CONTRIBUTOR
-- and UserRole enum from USER/ADMIN to USER/ADMIN/SUPERADMIN

-- Step 1: Update UserType enum (TASKER -> CONTRIBUTOR)
-- First, add the new value
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR';

-- Update existing TASKER records to CONTRIBUTOR
UPDATE "users" SET "user_type" = 'CONTRIBUTOR' WHERE "user_type" = 'TASKER';

-- Note: PostgreSQL doesn't support removing enum values directly
-- The old TASKER value will remain in the enum but won't be used
-- You can manually remove it later if needed using:
-- ALTER TYPE "UserType" RENAME TO "UserType_old";
-- CREATE TYPE "UserType" AS ENUM ('CREATOR', 'CONTRIBUTOR');
-- ALTER TABLE "users" ALTER COLUMN "user_type" TYPE "UserType" USING "user_type"::text::"UserType";
-- DROP TYPE "UserType_old";

-- Step 2: Update UserRole enum (add SUPERADMIN)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

