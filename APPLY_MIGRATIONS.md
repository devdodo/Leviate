# Apply Missing Database Migrations

Your database is missing the `withdrawal_otp` columns and `bank_accounts` table. Follow these steps to fix it:

## Option 1: Using Prisma Migrate (Recommended)

```bash
cd elevare
npx prisma migrate deploy
```

## Option 2: Manual SQL Execution

If Prisma migrate doesn't work, you can run the SQL directly:

1. Connect to your PostgreSQL database
2. Run the SQL from `apply_missing_migrations.sql`:

```bash
# Using psql
psql -h your-db-host -U your-username -d your-database -f apply_missing_migrations.sql

# Or copy the SQL from apply_missing_migrations.sql and run it in your database client
```

## What This Migration Adds

1. **Users table columns:**
   - `withdrawal_otp` (VARCHAR(10)) - For OTP verification during withdrawals
   - `withdrawal_otp_expires_at` (TIMESTAMPTZ) - OTP expiration timestamp

2. **Bank accounts table:**
   - Complete `bank_accounts` table with all required fields
   - Indexes for performance
   - Foreign key relationship to users table

## Verify Migration

After applying, verify with:

```bash
npx prisma migrate status
```

You should see all migrations as applied.

