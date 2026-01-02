# Fix: Prisma Client File Lock Error

## The Problem
```
EPERM: operation not permitted, unlink '...query_engine-windows.dll.node'
```

This happens when the Prisma query engine file is locked by a running process (usually your dev server or IDE).

## Solutions (Try in Order)

### Solution 1: Stop All Processes
1. **Stop your development server** - Press `Ctrl+C` in the terminal where it's running
2. **Close your IDE/editor** (VS Code, Cursor, etc.)
3. **Run:**
   ```bash
   npx prisma generate
   ```

### Solution 2: Use Force Regenerate Script
```bash
npm run prisma:force-generate
```

This script will:
- Attempt to stop Node.js processes
- Clear the Prisma client cache
- Regenerate the client

### Solution 3: Manual File Deletion
1. Stop all Node.js processes
2. Navigate to: `elevare/node_modules/.prisma/`
3. Delete the entire `.prisma` folder
4. Run: `npx prisma generate`

### Solution 4: Restart Computer
If nothing else works, restart your computer to release all file locks, then run:
```bash
npx prisma generate
```

## After Regeneration

Once successful, restart your development server:
```bash
npm run start:dev
```

The TypeScript errors for `withdrawalOtp` and `bankAccount` will be resolved.

