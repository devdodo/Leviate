-- Columns referenced by Prisma TaskSubmission but missing on some production DBs

ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "verified_by_id" TEXT;
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "admin_comment" TEXT;
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6);

DO $$ BEGIN
    ALTER TABLE "task_submissions"
      ADD CONSTRAINT "task_submissions_verified_by_id_fkey"
      FOREIGN KEY ("verified_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "task_submissions_verified_by_id_idx" ON "task_submissions"("verified_by_id");
