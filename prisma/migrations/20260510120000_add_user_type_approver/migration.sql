-- Ensure UserRole includes SUPERADMIN (may be missing if update_user_roles was never deployed)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- Add APPROVER to UserType (staff accounts for submission review)
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'APPROVER';

-- Align existing admin accounts with approver user type
UPDATE "users"
SET "user_type" = 'APPROVER'
WHERE "role"::text IN ('ADMIN', 'SUPERADMIN')
  AND "user_type"::text IN ('CREATOR', 'CONTRIBUTOR', 'TASKER');
