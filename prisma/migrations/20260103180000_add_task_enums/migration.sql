-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('MAKE_POST', 'COMMENT_POST', 'LIKE_SHARE_SAVE_REPOST', 'FOLLOW_ACCOUNT');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'TEXT', 'IMAGE');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" "TaskType" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" "TaskCategory" NOT NULL DEFAULT 'MAKE_POST';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "content_type" "ContentType";
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(10,2);

-- Migrate existing data: set budget from budgetPerTask or totalBudget
UPDATE "tasks" 
SET "budget" = COALESCE("budget_per_task", "total_budget", 0)
WHERE "budget" IS NULL;

-- Make budget NOT NULL after migration
ALTER TABLE "tasks" ALTER COLUMN "budget" SET NOT NULL;

-- Note: Legacy fields (goals, postType, budgetPerTask, totalBudget) are kept for backward compatibility
-- They can be removed in a future migration after ensuring all code is updated

