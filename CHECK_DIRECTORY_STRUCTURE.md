# Check Your Directory Structure

## Common Issue: Wrong Directory

If you get errors like:
- `Prisma schema not found`
- `package.json not found`
- `Command failed with exit code 1`

You're likely in the wrong directory!

## Correct Directory Structure

Your repository structure should be:
```
/var/www/Leviate/          ← Root of git repo
  └── elevare/             ← NestJS application (THIS is where you need to be!)
      ├── prisma/
      │   └── schema.prisma
      ├── src/
      ├── package.json
      └── .env
```

## How to Check

```bash
# Check current directory
pwd
# Should show: /var/www/Leviate/elevare

# Check if you're in the right place
ls -la

# You should see:
# - prisma/ folder
# - src/ folder
# - package.json
# - tsconfig.json
```

## Fix: Navigate to Correct Directory

```bash
# If you're in /var/www/Leviate
cd elevare

# Verify
ls -la prisma/schema.prisma
# Should show the file, not "No such file or directory"

# Now run your commands
npm install --production --legacy-peer-deps
./node_modules/.bin/prisma generate
```

## Quick Test

```bash
# This should work if you're in the right directory
cat package.json | grep "name"
# Should show: "name": "elevare"

# This should show the schema
head -5 prisma/schema.prisma
# Should show: // This is your Prisma schema file
```

