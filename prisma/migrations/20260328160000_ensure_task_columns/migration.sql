-- Repair databases that never received task_type / enums (idempotent; safe if already applied)

DO $$ BEGIN
    CREATE TYPE "TaskType" AS ENUM ('SINGLE', 'MULTI');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaskCategory" AS ENUM ('MAKE_POST', 'COMMENT_POST', 'LIKE_SHARE_SAVE_REPOST', 'FOLLOW_ACCOUNT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'TEXT', 'IMAGE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" "TaskType" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" "TaskCategory" NOT NULL DEFAULT 'MAKE_POST';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "content_type" "ContentType";
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(10,2);

UPDATE "tasks"
SET "budget" = COALESCE("budget_per_task", "total_budget", 0)
WHERE "budget" IS NULL;

ALTER TABLE "tasks" ALTER COLUMN "budget" SET NOT NULL;
