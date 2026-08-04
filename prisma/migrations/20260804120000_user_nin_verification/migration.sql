-- EncryptionService stores NIN as `iv:ciphertext:authTag` in hex (~88 chars for an
-- 11-digit NIN), so the original VarChar(20) could never have held a real value.
ALTER TABLE "users" ALTER COLUMN "nin_number" TYPE VARCHAR(255);

-- SHA-256 of the raw NIN. AES-256-GCM uses a random IV, so the same NIN encrypts to
-- different ciphertext every time and cannot be matched across rows — this hash is
-- what lets us detect one NIN being reused on multiple accounts.
ALTER TABLE "users" ADD COLUMN "nin_hash" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN "nin_verified_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "users_nin_hash_key" ON "users"("nin_hash");

-- Rows verified by the previous stub were marked verified without any NIMC check.
-- Reset them so they go through real verification; nin_number stays for audit.
UPDATE "users" SET "nin_verified" = false WHERE "nin_verified" = true;
