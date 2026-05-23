ALTER TABLE "users" ADD COLUMN "social_verification_code" VARCHAR(20);

UPDATE "users"
SET "social_verification_code" = 'LV-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8))
WHERE "social_verification_code" IS NULL;

ALTER TABLE "users" ALTER COLUMN "social_verification_code" SET NOT NULL;

CREATE UNIQUE INDEX "users_social_verification_code_key" ON "users"("social_verification_code");
