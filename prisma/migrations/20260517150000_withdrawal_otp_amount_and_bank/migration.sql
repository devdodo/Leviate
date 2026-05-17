ALTER TABLE "withdrawal_otps" ADD COLUMN "amount" DECIMAL(10,2);
ALTER TABLE "withdrawal_otps" ADD COLUMN "bank_account_id" TEXT;

ALTER TABLE "withdrawal_otps"
  ADD CONSTRAINT "withdrawal_otps_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "withdrawal_otps_bank_account_id_idx" ON "withdrawal_otps"("bank_account_id");
