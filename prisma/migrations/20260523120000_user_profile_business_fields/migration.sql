-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "is_business" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_profiles" ADD COLUMN "business_name" VARCHAR(255);
