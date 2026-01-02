# Fix Prisma Version Issue Locally

## Problem
`npx prisma` is downloading Prisma 7.2.0 from the registry instead of using local Prisma 5.19.1.

## Solution

### Option 1: Use npm scripts (Recommended)

The `package.json` has been updated with scripts that use the local Prisma:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Option 2: Use local binary directly

```bash
# Windows (PowerShell)
.\node_modules\.bin\prisma generate

# Linux/Mac
./node_modules/.bin/prisma generate
```

### Option 3: Use npx with package.json resolution

```bash
# This will use the version from package.json
npx --package=prisma@5.19.1 prisma generate
```

## Verify Local Prisma Version

```bash
# Check installed version
npm list prisma
# Should show: prisma@5.19.1

# Check Prisma client version
npm list @prisma/client
# Should show: @prisma/client@5.19.1
```

## Why This Happens

- `npx prisma` without version specifier downloads the latest (7.2.0)
- Your project uses Prisma 5.19.1 (defined in package.json)
- Using `prisma` directly in npm scripts uses the local version from node_modules

## Updated Scripts

The following scripts now use the local Prisma:
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Deploy migrations
- `npm run prisma:migrate:dev` - Create new migration

These will work on both local and server environments.

