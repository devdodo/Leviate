# Quick Fix: Prisma Version Mismatch

## Error
```
Error: The datasource property `url` is no longer supported in schema files.
Prisma CLI Version : 7.2.0
```

## Problem
You have Prisma 7.x installed globally, but the project uses Prisma 5.19.1. Prisma 7 has breaking changes.

## Immediate Fix

### Option 1: Use Local Prisma (Recommended)

```bash
# Navigate to project
cd /var/www/Leviate/elevare

# IMPORTANT: Install dependencies first to get local Prisma
npm install --production --legacy-peer-deps

# Now use the local Prisma from node_modules
./node_modules/.bin/prisma --version
# Should show: prisma 5.19.1

# Generate Prisma client using local version
./node_modules/.bin/prisma generate

# Run migrations
./node_modules/.bin/prisma migrate deploy
```

### Option 2: Use npm scripts (Easier)

```bash
# Navigate to the elevare subdirectory
cd /var/www/Leviate/elevare

# Verify you're in the right place
ls -la prisma/schema.prisma

# Install dependencies first
npm install --production --legacy-peer-deps

# Use npm scripts which automatically use local Prisma
npm run prisma:generate
```

### Option 3: Use npx with correct directory

```bash
# Make sure you're in the elevare directory
cd /var/www/Leviate/elevare

# Install dependencies first
npm install --production --legacy-peer-deps

# Now npx will use the local version
npx prisma generate
npx prisma migrate deploy
```

### Option 3: Force npx to use local version

```bash
cd /var/www/Leviate/elevare

# Install dependencies first
npm install --production --legacy-peer-deps

# Use npx with --yes and specify version
npx --yes prisma@5.19.1 generate
npx --yes prisma@5.19.1 migrate deploy
```

### Option 2: Uninstall Global Prisma 7

```bash
# Check global Prisma
npm list -g prisma

# Uninstall if it's Prisma 7
sudo npm uninstall -g prisma

# Use local version
cd /var/www/Leviate/elevare
npx prisma generate
```

## Verify Fix

```bash
# Should show Prisma 5.19.1
npx prisma --version

# Should work without errors
npx prisma generate
```

## Why This Happens

- Prisma 7 changed the schema format (breaking change)
- Your project uses Prisma 5.19.1 (defined in package.json)
- Global Prisma 7 takes precedence over local version
- Solution: Remove global Prisma 7 or ensure npx uses local version

