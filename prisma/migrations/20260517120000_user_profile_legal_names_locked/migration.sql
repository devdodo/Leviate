-- Lock legal names on profile after first save (used for bank account verification)
ALTER TABLE "user_profiles" ADD COLUMN "legal_names_locked_at" TIMESTAMPTZ(6);

-- Existing profiles with both names are treated as already locked
UPDATE "user_profiles"
SET "legal_names_locked_at" = NOW()
WHERE "first_name" IS NOT NULL
  AND TRIM("first_name") <> ''
  AND "last_name" IS NOT NULL
  AND TRIM("last_name") <> '';
