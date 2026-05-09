-- AlterTable
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "proofs" JSONB;
