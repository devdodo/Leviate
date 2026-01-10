-- AlterEnum
-- This migration updates UserType enum from CREATOR/TASKER to CREATOR/CONTRIBUTOR
-- and UserRole enum from USER/ADMIN to USER/ADMIN/SUPERADMIN

-- Step 1: Add CONTRIBUTOR to UserType enum
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR';

-- Step 2: Add SUPERADMIN to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- Note: The UPDATE statement for TASKER -> CONTRIBUTOR was removed because
-- PostgreSQL requires enum values to be committed before use in the same transaction.
-- This update should be done manually or in a separate migration/script.

