-- contributor_summary was in prisma/schema.prisma but never migrated on some databases

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "contributor_summary" TEXT;
