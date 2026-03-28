-- Payment fields on tasks (schema had them; some DBs never got a migration)

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "payment_authorization_url" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "payment_verified_at" TIMESTAMPTZ(6);

DO $$ BEGIN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_payment_reference_key" UNIQUE ("payment_reference");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
