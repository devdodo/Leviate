# Create Database - Quick Guide

## Current Status
✅ **Connection is working!**  
❌ Database `elevare` does not exist

## Solution: Create the Database

You have 3 options to create the database:

---

## Option 1: Using the Script (Easiest)

1. **Update your `.env` file temporarily** to connect to `postgres` database:
   ```env
   DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/postgres?sslmode=require
   ```
   (Change `/elevare` to `/postgres`)

2. **Run the create script:**
   ```bash
   cd elevare
   node create-database.js
   ```

3. **Change back to `elevare` database** in `.env`:
   ```env
   DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/elevare?sslmode=require
   ```

4. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

---

## Option 2: Using psql (If you have it installed)

1. **Connect to PostgreSQL:**
   ```bash
   psql -h elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com -U elevare_admin -d postgres
   ```

2. **Create the database:**
   ```sql
   CREATE DATABASE elevare;
   \q
   ```

3. **Run migrations:**
   ```bash
   cd elevare
   npx prisma migrate dev --name init
   ```

---

## Option 3: Using AWS RDS Query Editor (If Available)

1. Go to **AWS RDS Console** → Your database
2. Click **"Query Editor"** (if available in your region)
3. Connect to the `postgres` database
4. Run:
   ```sql
   CREATE DATABASE elevare;
   ```

---

## Option 4: Using Prisma Migrate (Recommended)

Prisma can create the database automatically if you have the right permissions:

1. **Make sure your `.env` points to `postgres` database:**
   ```env
   DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/postgres?sslmode=require
   ```

2. **Create database using Prisma:**
   ```bash
   cd elevare
   npx prisma db execute --stdin
   ```
   Then type: `CREATE DATABASE elevare;` and press Enter

   **OR** use the script I created:
   ```bash
   node create-database.js
   ```

3. **Update `.env` back to `elevare` database:**
   ```env
   DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/elevare?sslmode=require
   ```

4. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

---

## After Database is Created

Once the database exists, run migrations to create all tables:

```bash
cd elevare
npx prisma migrate dev --name init
```

This will:
- ✅ Create all tables from your Prisma schema
- ✅ Set up relationships
- ✅ Create indexes
- ✅ Generate Prisma Client

---

## Verify Database Creation

Test that everything works:

```bash
# Test connection
node test-db-connection.js

# Or start your app
npm run start:dev
```

---

## Troubleshooting

### Error: "Permission denied to create database"

**Solution:** Your user might not have `CREATEDB` privilege. You can:

1. **Create database manually** using AWS RDS Console (if Query Editor available)
2. **Or** modify the master user to have superuser privileges (not recommended for production)
3. **Or** create the database using the master user credentials

### Error: "Database already exists"

Great! The database is already created. Just run migrations:
```bash
npx prisma migrate dev --name init
```

---

## Quick Command Summary

```bash
# 1. Create database (using script)
node create-database.js

# 2. Run migrations
npx prisma migrate dev --name init

# 3. Verify
node test-db-connection.js

# 4. Start app
npm run start:dev
```

