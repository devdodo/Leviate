-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "campaign_disputes" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "admin_comment" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaign_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_disputes_task_id_idx" ON "campaign_disputes"("task_id");

-- CreateIndex
CREATE INDEX "campaign_disputes_creator_id_idx" ON "campaign_disputes"("creator_id");

-- CreateIndex
CREATE INDEX "campaign_disputes_status_idx" ON "campaign_disputes"("status");

-- CreateIndex
CREATE INDEX "campaign_disputes_created_at_idx" ON "campaign_disputes"("created_at");

-- AddForeignKey
ALTER TABLE "campaign_disputes" ADD CONSTRAINT "campaign_disputes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_disputes" ADD CONSTRAINT "campaign_disputes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_disputes" ADD CONSTRAINT "campaign_disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
