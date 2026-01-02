# Roles Implementation Guide

## Overview

The platform now supports the following roles:
- **CREATOR**: Users who post tasks
- **CONTRIBUTOR**: Users who complete tasks (formerly TASKER)
- **ADMIN**: Limited admin access
- **SUPERADMIN**: Full admin access (can create other admins)

## Role Hierarchy

1. **USER** (default) - Regular users (CREATOR or CONTRIBUTOR)
2. **ADMIN** - Limited admin privileges
3. **SUPERADMIN** - Full admin privileges

## Permission Matrix

### ADMIN Access
- View all users
- View user details
- Suspend/unsuspend regular users (not ADMIN or SUPERADMIN)
- View all tasks
- View system statistics

### SUPERADMIN Access
- All ADMIN permissions, plus:
- Create new ADMIN or SUPERADMIN accounts
- View all admins
- View audit log
- Suspend ADMIN users (ADMIN cannot suspend other ADMINS)

## Database Migration

### Step 1: Update Enums

Run the migration to update the database enums:

```bash
# Apply the migration
npx prisma migrate deploy

# Or if in development
npx prisma migrate dev
```

The migration will:
1. Add `CONTRIBUTOR` to `UserType` enum
2. Update all existing `TASKER` records to `CONTRIBUTOR`
3. Add `SUPERADMIN` to `UserRole` enum

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

## Seeding the First Super Admin

### Option 1: Using Environment Variables (Recommended)

1. Add to your `.env` file:
```env
SUPERADMIN_EMAIL=superadmin@leviateapp.com
SUPERADMIN_PASSWORD=YourSecurePassword123!
```

2. Run the seeder:
```bash
npm run seed
# or
npx prisma db seed
```

### Option 2: Using Default Credentials

If you don't set environment variables, the seeder will use:
- Email: `superadmin@leviateapp.com`
- Password: `SuperAdmin123!`

**⚠️ IMPORTANT**: Change the default password immediately after first login!

### Seeder Behavior

- The seeder checks if a SUPERADMIN already exists
- If one exists, it skips seeding
- If the email already exists (as a regular user), it will show a warning

## Creating Additional Admins

Only SUPERADMIN users can create new admins.

### Endpoint: `POST /api/admin/create-admin`

**Headers:**
```
Authorization: Bearer <SUPERADMIN_JWT_TOKEN>
```

**Body:**
```json
{
  "email": "admin@leviateapp.com",
  "password": "SecurePassword123!",
  "role": "ADMIN",  // or "SUPERADMIN"
  "userType": "CREATOR"  // optional, defaults to CREATOR
}
```

**Response:**
```json
{
  "message": "ADMIN created successfully",
  "data": {
    "id": "uuid",
    "email": "admin@leviateapp.com",
    "role": "ADMIN",
    "userType": "CREATOR",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

## Admin Endpoints

### All Admin Endpoints (ADMIN and SUPERADMIN)
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/suspend` - Suspend user
- `PUT /api/admin/users/:id/unsuspend` - Unsuspend user
- `GET /api/admin/tasks` - List all tasks
- `GET /api/admin/statistics` - Get system statistics

### SUPERADMIN Only Endpoints
- `POST /api/admin/create-admin` - Create new admin
- `GET /api/admin/admins` - List all admins
- `GET /api/admin/audit-log` - View audit log

## Role-Based Guards

### Using Roles Guard

```typescript
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@Controller('admin')
export class AdminController {
  // ...
}
```

### Using SuperAdmin Guard

```typescript
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Post('create-admin')
async createAdmin() {
  // Only SUPERADMIN can access
}
```

## Code Changes Summary

### Schema Changes
- `UserType`: `CREATOR` | `CONTRIBUTOR` (was `CREATOR` | `TASKER`)
- `UserRole`: `USER` | `ADMIN` | `SUPERADMIN` (was `USER` | `ADMIN`)

### Updated Files
- `prisma/schema.prisma` - Updated enums
- `src/admin/admin.service.ts` - Added role-based permissions
- `src/admin/admin.controller.ts` - Added SUPERADMIN-only endpoints
- `src/common/guards/super-admin.guard.ts` - New guard for SUPERADMIN
- `src/auth/dto/signup.dto.ts` - Updated UserType description
- `src/tasks/tasks.service.ts` - Updated to use CONTRIBUTOR
- `src/recommendations/recommendations.service.ts` - Updated to use CONTRIBUTOR
- `prisma/seed.ts` - Seeder for first super admin

### Migration File
- `prisma/migrations/update_user_roles/migration.sql` - Database migration

## Testing

1. **Seed the super admin:**
   ```bash
   npm run seed
   ```

2. **Login as super admin:**
   ```bash
   POST /api/auth/login
   {
     "email": "superadmin@leviateapp.com",
     "password": "SuperAdmin123!"
   }
   ```

3. **Create an admin:**
   ```bash
   POST /api/admin/create-admin
   Authorization: Bearer <superadmin_token>
   {
     "email": "admin@leviateapp.com",
     "password": "Admin123!",
     "role": "ADMIN"
   }
   ```

4. **Test role restrictions:**
   - Try accessing SUPERADMIN-only endpoints as ADMIN (should fail)
   - Try suspending an ADMIN as another ADMIN (should fail)
   - Try suspending an ADMIN as SUPERADMIN (should succeed)

## Notes

- Database field names like `taskerId` remain unchanged for backward compatibility
- The old `TASKER` enum value will remain in the database but won't be used
- All existing `TASKER` users are automatically converted to `CONTRIBUTOR` by the migration
- Admins are created with `emailVerified: true` and `profileComplete: true`
- Admins start with `reputationScore: 100`

