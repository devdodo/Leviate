-- Backfill proofs from legacy columns when proofs was never set
UPDATE "task_submissions"
SET "proofs" = jsonb_build_array(
  jsonb_build_object(
    'proofType', "proof_type"::text,
    'proofUrl', "proof_url"
  )
)
WHERE "proofs" IS NULL;

-- Drop legacy single-proof columns
ALTER TABLE "task_submissions" DROP COLUMN "proof_type";
ALTER TABLE "task_submissions" DROP COLUMN "proof_url";

-- Enforce proofs for all rows
ALTER TABLE "task_submissions" ALTER COLUMN "proofs" SET NOT NULL;

-- Proof types now live only inside JSON proofs[]. Drop unused PG enum.
DROP TYPE IF EXISTS "ProofType";
