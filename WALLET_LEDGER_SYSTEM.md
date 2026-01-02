# Wallet Ledger System Documentation

## Overview

The wallet system uses **double-entry bookkeeping** principles to ensure financial integrity and prevent discrepancies. All financial transactions are recorded in the `wallet_transactions` table, which serves as the complete ledger.

## Database Tables

### 1. `wallet_transactions` Table

This is the main ledger table that records all financial transactions. It implements double-entry bookkeeping.

**Schema:**
```sql
CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_type VARCHAR(10) NOT NULL, -- 'CREDIT' or 'DEBIT'
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  transaction_category VARCHAR(20) NOT NULL,
  reference_id TEXT, -- Links to task/submission/withdrawal
  description VARCHAR(500) NOT NULL,
  status VARCHAR(10) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED', 'REVERSED'
  counterpart_id TEXT, -- For double-entry (links to paired transaction)
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
```

**Indexes:**
- `wallet_transactions_user_id_idx` - For user balance queries
- `wallet_transactions_transaction_type_idx` - For filtering credits/debits
- `wallet_transactions_transaction_category_idx` - For filtering by category
- `wallet_transactions_status_idx` - For filtering by status
- `wallet_transactions_created_at_idx` - For transaction history
- `wallet_transactions_reference_id_idx` - For linking to related entities

### 2. `withdrawal_otps` Table

Stores withdrawal OTP verification codes separately from the users table.

**Schema:**
```sql
CREATE TABLE withdrawal_otps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
```

## Double-Entry Bookkeeping

### Core Principles

1. **Every Transaction Has Two Entries**: Credit and Debit
2. **Balance Always Balances**: Sum of credits = Sum of debits
3. **Atomic Operations**: All ledger entries in a single database transaction
4. **Immutable Records**: Transactions cannot be deleted, only reversed
5. **Audit Trail**: Complete history of all financial movements

### Transaction Flow Example: Task Payout

When a task is verified and payout occurs:

1. **DEBIT Creator's Wallet** (Task Budget)
   - Amount: -N2,000
   - Category: `TASK_PAYOUT`
   - Reference: `task_id`
   - Type: `DEBIT`

2. **CREDIT Contributor's Wallet** (Earnings)
   - Amount: +N1,900 (after 5% platform fee)
   - Category: `TASK_PAYOUT`
   - Reference: `submission_id`
   - Type: `CREDIT`

3. **CREDIT Platform Wallet** (Fee Collection)
   - Amount: +N100 (5% platform fee)
   - Category: `PLATFORM_FEE`
   - Reference: `task_id`
   - Type: `CREDIT`

4. **DEBIT Platform Wallet** (Fee Collection)
   - Amount: -N100
   - Category: `PLATFORM_FEE`
   - Reference: `task_id`
   - Type: `DEBIT`

### Balance Calculation

User balance is calculated in real-time from ledger entries:

```typescript
balance = SUM(CREDIT transactions) - SUM(DEBIT transactions)
```

Only transactions with `status = 'COMPLETED'` are included in balance calculations.

## Transaction Categories

### Credit Categories
- `TASK_PAYOUT`: Payment received for completing a task
- `REFERRAL_BONUS`: Reward for referring a user
- `REFUND`: Refund for cancelled/failed task
- `DEPOSIT`: Direct deposit to wallet

### Debit Categories
- `TASK_PAYOUT`: Payment made for task completion (from creator)
- `WITHDRAWAL`: Funds withdrawn to bank account
- `PLATFORM_FEE`: Platform fee deducted
- `REFUND`: Refund processed

## Transaction Statuses

- `PENDING`: Transaction initiated but not yet completed
- `COMPLETED`: Transaction successfully completed
- `FAILED`: Transaction failed (e.g., bank transfer failed)
- `REVERSED`: Transaction was reversed/refunded

## How to Query the Ledger

### Get User Balance

```typescript
// Calculate from completed transactions
const balance = await prisma.walletTransaction.aggregate({
  where: {
    userId: 'user-id',
    status: 'COMPLETED',
  },
  _sum: {
    amount: true, // Sum all amounts (credits positive, debits negative)
  },
});
```

### Get Transaction History

```typescript
const transactions = await prisma.walletTransaction.findMany({
  where: {
    userId: 'user-id',
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 20,
  skip: 0,
});
```

### Get Transactions by Category

```typescript
const taskPayouts = await prisma.walletTransaction.findMany({
  where: {
    userId: 'user-id',
    transactionCategory: 'TASK_PAYOUT',
    transactionType: 'CREDIT',
    status: 'COMPLETED',
  },
});
```

## Wallet Service Methods

The `WalletService` provides these key methods:

1. **`getBalance(userId)`** - Get current wallet balance
2. **`credit(userId, amount, category, description)`** - Credit user wallet
3. **`debit(userId, amount, category, description)`** - Debit user wallet
4. **`getTransactions(userId, query)`** - Get transaction history with pagination
5. **`withdraw(userId, amount, bankAccountId)`** - Process withdrawal (requires OTP)

## Withdrawal OTP System

Withdrawal OTPs are stored in the `withdrawal_otps` table:

- Each OTP has a 10-minute expiration
- OTPs are marked as `used` after successful verification
- Only one active (unused, unexpired) OTP per user at a time
- Old unused OTPs are automatically marked as used when a new one is generated

## Security Features

1. **Atomic Transactions**: All ledger entries use database transactions
2. **Balance Locking**: Balance is calculated atomically during operations
3. **Idempotency**: Transactions can be safely retried
4. **Audit Trail**: Complete history of all financial movements
5. **OTP Verification**: Required for all withdrawals
6. **NIN Verification**: Required before withdrawals can be processed

## Verifying Ledger Integrity

You can verify the ledger integrity by checking:

```sql
-- Sum of all credits should equal sum of all debits (for completed transactions)
SELECT 
  transaction_type,
  SUM(amount) as total
FROM wallet_transactions
WHERE status = 'COMPLETED'
GROUP BY transaction_type;
```

The sum of CREDITS should equal the sum of DEBITS (accounting for platform fees).

## Notes

- The ledger system does NOT store a "current balance" field - balance is always calculated from transactions
- This ensures data integrity and prevents balance discrepancies
- All financial operations go through the `WalletService` which maintains ledger consistency
- The `wallet_transactions` table is the single source of truth for all financial data

