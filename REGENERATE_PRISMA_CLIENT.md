# Regenerate Prisma Client

The Prisma client needs to be regenerated after schema changes. The error occurs because the TypeScript types don't include the new `WithdrawalOtp` and `BankAccount` models.

## Steps to Fix

1. **Stop your development server** (if running)
   - Press `Ctrl+C` in the terminal where the server is running

2. **Regenerate Prisma Client**
   ```bash
   cd elevare
   npx prisma generate
   ```

3. **Restart your development server**
   ```bash
   npm run start:dev
   ```

## Why This Happens

When you add new models to `schema.prisma`, Prisma needs to regenerate the TypeScript client to include:
- Type definitions for the new models
- Methods like `prisma.withdrawalOtp.create()`, `prisma.bankAccount.findMany()`, etc.

The Prisma client is generated in `node_modules/.prisma/client/` and TypeScript uses these generated types for type checking.

## Alternative: If File is Locked

If you get a "file is locked" error:
1. Close all instances of your IDE/editor
2. Stop all Node.js processes
3. Run `npx prisma generate` again
4. Restart your IDE and server

