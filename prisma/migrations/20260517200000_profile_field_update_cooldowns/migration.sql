ALTER TABLE "user_profiles" ADD COLUMN "hobbies_interests_updated_at" TIMESTAMPTZ(6);
ALTER TABLE "user_profiles" ADD COLUMN "social_media_handles_updated_at" TIMESTAMPTZ(6);

UPDATE "user_profiles"
SET "hobbies_interests_updated_at" = "updated_at"
WHERE "hobbies_interests" IS NOT NULL
  AND "hobbies_interests"::text NOT IN ('null', '[]');

UPDATE "user_profiles"
SET "social_media_handles_updated_at" = "updated_at"
WHERE "social_media_handles" IS NOT NULL
  AND "social_media_handles"::text NOT IN ('null', '{}');
