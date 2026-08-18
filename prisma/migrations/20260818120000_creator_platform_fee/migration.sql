-- Contributor pot, excluding the creator platform fee.
-- Left NULL on existing campaigns: those funded the pool exactly (no fee was
-- added on top), so budget already IS the pool and the app falls back to it.
ALTER TABLE "tasks" ADD COLUMN "payout_pool" DECIMAL(10,2);

-- The fee moved from a 5% contributor-side deduction to a 7% creator-side
-- charge. Existing rows keep their recorded 5 for audit; it is no longer
-- deducted from anyone, and new campaigns default to 7.
ALTER TABLE "tasks" ALTER COLUMN "platform_fee_percentage" SET DEFAULT 7;
