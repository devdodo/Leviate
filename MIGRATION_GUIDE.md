# Database Migration Guide

## Update Reputation Score Default

The reputation score default has been changed from 50 to 75. You need to run a migration.

### Step 1: Create Migration

```bash
cd elevare
npx prisma migrate dev --name update_reputation_default_to_75
```

This will:
- Update the default value in the schema
- Create a migration file
- Apply the migration to your database

### Step 2: Update Existing Users (Optional)

If you have existing users with reputation score of 50, you can update them:

```sql
-- Update existing users to 75 if they have email verified
UPDATE users 
SET reputation_score = 75 
WHERE reputation_score = 50 
  AND email_verified = true;
```

### Step 3: Verify

Check that the default is working:

```sql
-- Check schema default
SELECT column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'reputation_score';

-- Should show: 75
```

---

## New Tables/Columns

No new tables were added. Only the default value for `reputation_score` was changed.

---

## Rollback (If Needed)

If you need to rollback:

```bash
npx prisma migrate reset
```

⚠️ **Warning:** This will delete all data! Only use in development.

