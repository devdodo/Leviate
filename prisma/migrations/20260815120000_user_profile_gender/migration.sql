-- Self-reported contributor gender, so creators can aim a task at one.
-- PREFER_NOT_TO_SAY is stored as an answer in its own right: it means "asked and
-- declined", which matches only tasks open to all genders — same outcome as NULL
-- for matching, but distinguishable for reporting on onboarding completion.
CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- Nullable: every existing profile predates the field, and onboarding accepts a
-- payload without it so app builds that ship before the client update still work.
ALTER TABLE "user_profiles" ADD COLUMN "gender" "UserGender";

-- Gender-targeted tasks filter contributors on this column.
CREATE INDEX "user_profiles_gender_idx" ON "user_profiles"("gender");
