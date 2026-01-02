# Leviate Backend - Setup Guide

## ✅ Completed Setup

### 1. Dependencies Installed
- ✅ Prisma ORM (v5.19.1) with PostgreSQL
- ✅ NestJS JWT & Passport authentication
- ✅ Swagger/OpenAPI documentation
- ✅ Class Validator & Transformer
- ✅ Bcrypt for password hashing
- ✅ Throttler for rate limiting
- ✅ Helmet for security headers
- ✅ BullMQ for background jobs
- ✅ Nodemailer for email (Zeptomail integration pending)

### 2. Database Schema
- ✅ Complete Prisma schema with all models:
  - User, UserProfile
  - Task, TaskApplication, TaskSubmission
  - WalletTransaction (Double-entry ledger)
  - Notification
  - Referral
  - AdminAction
- ✅ All enums defined
- ✅ Proper relationships and indexes

### 3. Base Infrastructure
- ✅ Base response interceptor (standardized API responses)
- ✅ Global exception filter
- ✅ JWT authentication guard
- ✅ Roles guard (for admin access)
- ✅ Public decorator (for public endpoints)
- ✅ CurrentUser decorator
- ✅ Pagination DTOs

### 4. Swagger Documentation
- ✅ Swagger configured in main.ts
- ✅ Bearer token authentication
- ✅ API tags defined
- ✅ Accessible at `/api/docs`

### 5. Authentication Module
- ✅ Signup endpoint
- ✅ Email verification
- ✅ Login endpoint
- ✅ Change password
- ✅ Forgot password
- ✅ Reset password
- ✅ JWT strategy
- ✅ All DTOs with validation

### 6. Configuration
- ✅ ConfigModule setup
- ✅ PrismaService (global)
- ✅ Environment variables structure

## 🚀 Next Steps

### Immediate
1. **Set up .env file** with database connection and secrets
2. **Run database migration**: `npx prisma migrate dev`
3. **Test authentication endpoints** via Swagger

### Phase 1 Remaining
- [ ] User Management Module (profile, onboarding)
- [ ] Encryption Service (for NIN storage)
- [ ] Zeptomail Email Service integration

### Phase 2
- [ ] Task/Job Module
- [ ] File Upload Service
- [ ] AI Brief Generation

### Phase 3
- [ ] Submission & Verification Module
- [ ] AI Verification System

### Phase 4
- [ ] Wallet/Ledger Module (Double-entry bookkeeping)
- [ ] Withdrawal Processing

## 📝 Environment Variables Required

Create a `.env` file in the `elevare` directory with:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elevare

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Email (Zeptomail)
ZEPTOMAIL_TOKEN=your-zeptomail-token
ZEPTOMAIL_BOUNCE_ADDRESS=noreply@leviateapp.com
FROM_EMAIL=noreply@leviateapp.com
FROM_NAME=Leviate

# App Config
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
NODE_ENV=development

# Swagger
SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs
```

## 🗄️ Database Setup

1. **Create PostgreSQL database**:
   ```sql
   CREATE DATABASE elevare;
   ```

2. **Run Prisma migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Generate Prisma Client** (already done):
   ```bash
   npx prisma generate
   ```

## 🧪 Testing

1. **Start the server**:
   ```bash
   npm run start:dev
   ```

2. **Access Swagger UI**:
   ```
   http://localhost:3000/api/docs
   ```

3. **Test Authentication**:
   - Signup: `POST /api/auth/signup`
   - Verify Email: `POST /api/auth/verify-email`
   - Login: `POST /api/auth/login`

## 📁 Project Structure

```
elevare/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── auth/                   # Authentication module
│   │   ├── dto/               # Data Transfer Objects
│   │   ├── strategies/         # JWT strategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── common/                 # Shared code
│   │   ├── decorators/         # Custom decorators
│   │   ├── dto/                # Common DTOs
│   │   ├── filters/           # Exception filters
│   │   ├── guards/             # Auth guards
│   │   ├── interceptors/       # Response interceptors
│   │   └── services/           # Prisma service
│   ├── config/                 # Configuration
│   ├── app.module.ts
│   └── main.ts                 # Application entry
└── package.json
```

## 🔒 Security Features Implemented

- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ JWT authentication
- ✅ Rate limiting (Throttler)
- ✅ Security headers (Helmet)
- ✅ Input validation (class-validator)
- ✅ CORS configuration
- ✅ Global exception handling

## 📚 API Documentation

All endpoints are documented with Swagger. Access the interactive documentation at:
- Development: `http://localhost:3000/api/docs`

## 🐛 Known Issues / TODOs

1. **Zeptomail Integration**: Email service not yet integrated (placeholders in code)
2. **Password Reset Flag**: Need to implement flag to force password change after reset
3. **Social Media OAuth**: Not yet implemented (structure ready)
4. **Encryption Service**: NIN encryption not yet implemented

## 📞 Support

For issues or questions, refer to the `IMPLEMENTATION_BRIEF.md` in the root directory.

