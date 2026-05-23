-- CreateEnum
CREATE TYPE "SocialVerificationStatus" AS ENUM ('AWAITING_SUBMISSION', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum (idempotent for re-runs)
DO $$ BEGIN
  ALTER TYPE "AdminActionType" ADD VALUE 'VERIFY_SOCIAL_MEDIA';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AdminActionType" ADD VALUE 'REJECT_SOCIAL_MEDIA';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "user_social_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "handle" VARCHAR(255) NOT NULL,
    "profile_url" TEXT,
    "submitted_code" VARCHAR(100),
    "status" "SocialVerificationStatus" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_id" TEXT,
    "admin_comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_social_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_social_verifications_user_id_platform_key" ON "user_social_verifications"("user_id", "platform");
CREATE INDEX "user_social_verifications_status_idx" ON "user_social_verifications"("status");
CREATE INDEX "user_social_verifications_platform_idx" ON "user_social_verifications"("platform");

ALTER TABLE "user_social_verifications" ADD CONSTRAINT "user_social_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_social_verifications" ADD CONSTRAINT "user_social_verifications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
