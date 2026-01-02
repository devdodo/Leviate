# Environment Variables Reference

Complete reference for all environment variables used in the Leviate backend service.

## Quick Start

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Fill in the required values (marked with ⚠️)

3. Never commit `.env` to version control

---

## Required Variables (Must Set)

### ⚠️ Database
- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database?sslmode=require`
  - Required for: Database operations

### ⚠️ JWT Authentication
- `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)
  - Generate: `openssl rand -base64 32`
  - Required for: User authentication

### ⚠️ Server
- `NODE_ENV` - Environment (development, production, test)
  - Required for: Environment-specific behavior

---

## Recommended Variables (Should Set)

### Redis
- `REDIS_URL` - Redis connection string
  - Default: `redis://localhost:6379`
  - Required for: Caching, background jobs (BullMQ)

### Email Service
- `ZEPTOMAIL_TOKEN` - Zeptomail API token
- `FROM_EMAIL` - Sender email address
- `FROM_NAME` - Sender name
  - Required for: Email notifications, OTP codes

### Cloud Storage
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET` - S3 bucket name
- `AWS_REGION` - AWS region
  - Required for: File uploads (screenshots, proofs)

---

## Optional Variables (Feature-Specific)

### AI Service
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
  - Required for: AI brief generation, verification

### Payment Gateway
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
  - Required for: Withdrawals, payouts

### Social Media OAuth
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
- `SNAPCHAT_CLIENT_ID`, `SNAPCHAT_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
  - Required for: Social media account linking

### Encryption
- `ENCRYPTION_KEY` - 32-byte base64 key
  - Generate: `openssl rand -base64 32`
  - Required for: Encrypting sensitive data (NIN numbers)

---

## Configuration Categories

### Server Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `API_PREFIX` | `api` | API route prefix |
| `APP_URL` | `http://localhost:3000` | Application URL |
| `FRONTEND_URL` | `http://localhost:3001` | Frontend URL (for CORS) |

### Database
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |

### Redis
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |

### JWT
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | JWT signing secret (required) |
| `JWT_EXPIRES_IN` | `15m` | Access token expiration |
| `JWT_REFRESH_SECRET` | - | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiration |

### Rate Limiting
| Variable | Default | Description |
|----------|---------|-------------|
| `THROTTLER_TTL` | `60000` | Time window in milliseconds |
| `THROTTLER_LIMIT` | `100` | Max requests per window |

### Email (Zeptomail)
| Variable | Default | Description |
|----------|---------|-------------|
| `ZEPTOMAIL_TOKEN` | - | Zeptomail API token |
| `ZEPTOMAIL_BOUNCE_ADDRESS` | `noreply@leviateapp.com` | Bounce handling email |
| `FROM_EMAIL` | `noreply@leviateapp.com` | Sender email |
| `FROM_NAME` | `Leviate` | Sender name |

### AWS S3
| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret key |
| `AWS_S3_BUCKET` | `elevare-uploads` | S3 bucket name |
| `AWS_REGION` | `us-east-1` | AWS region |

### AI Service
| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4` | OpenAI model |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-3-opus-20240229` | Anthropic model |

### Payment Gateway
| Variable | Default | Description |
|----------|---------|-------------|
| `PAYSTACK_SECRET_KEY` | - | Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | - | Paystack public key |
| `PAYSTACK_BASE_URL` | `https://api.paystack.co` | Paystack API URL |

### Feature Flags
| Variable | Default | Description |
|----------|---------|-------------|
| `REFERRAL_REWARD_AMOUNT` | `100` | Referral reward amount |
| `PLATFORM_FEE_PERCENTAGE` | `5` | Platform fee percentage |
| `MIN_REPUTATION_FOR_AUTO_APPROVAL` | `75` | Min reputation for auto-approval |
| `DEFAULT_REPUTATION_SCORE` | `50` | Default user reputation |
| `MAX_REPUTATION_SCORE` | `100` | Maximum reputation score |
| `MIN_REPUTATION_SCORE` | `0` | Minimum reputation score |

### Encryption
| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | - | Encryption key (base64, 32 bytes) |
| `ENCRYPTION_ALGORITHM` | `aes-256-gcm` | Encryption algorithm |
| `ENCRYPTION_IV_LENGTH` | `16` | IV length in bytes |

### Notifications
| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFICATION_EMAIL_ENABLED` | `true` | Enable email notifications |
| `NOTIFICATION_QUEUE_NAME` | `email-notification` | Queue name |
| `NOTIFICATION_RETRY_ATTEMPTS` | `3` | Max retry attempts |
| `NOTIFICATION_RETRY_DELAY` | `5000` | Retry delay (ms) |

### Swagger
| Variable | Default | Description |
|----------|---------|-------------|
| `SWAGGER_ENABLED` | `true` | Enable Swagger UI |
| `SWAGGER_PATH` | `api/docs` | Swagger UI path |

### Logging
| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `debug` | Log level (error, warn, info, debug, verbose) |
| `LOG_FILE_ENABLED` | `false` | Enable file logging |
| `LOG_FILE_PATH` | `logs/app.log` | Log file path |

### File Upload
| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | `5242880` | Max file size in bytes (5MB) |
| `ALLOWED_FILE_TYPES` | `jpg,jpeg,png,webp,pdf` | Allowed file types |
| `UPLOAD_DESTINATION` | `s3` | Upload destination (s3, cloudinary, local) |

### Task Verification
| Variable | Default | Description |
|----------|---------|-------------|
| `AI_VERIFICATION_THRESHOLD` | `80` | Min verification score (0-100) |
| `VERIFICATION_JOB_INTERVAL` | `1800000` | Verification job interval (ms) |
| `OCR_SERVICE` | `openai` | OCR service (openai, google-vision, tesseract) |

### Wallet & Ledger
| Variable | Default | Description |
|----------|---------|-------------|
| `MIN_WITHDRAWAL_AMOUNT` | `100` | Minimum withdrawal amount |
| `MAX_WITHDRAWAL_AMOUNT` | `1000000` | Maximum withdrawal amount |
| `DAILY_WITHDRAWAL_LIMIT` | `500000` | Daily withdrawal limit |
| `WITHDRAWAL_FEE` | `0` | Withdrawal fee |
| `LEDGER_INTEGRITY_CHECK_ENABLED` | `true` | Enable integrity checks |
| `LEDGER_INTEGRITY_CHECK_SCHEDULE` | `0 2 * * *` | Cron schedule (daily 2 AM) |

### Security
| Variable | Default | Description |
|----------|---------|-------------|
| `BCRYPT_ROUNDS` | `12` | Bcrypt salt rounds |
| `SESSION_SECRET` | - | Session secret |
| `CORS_ORIGINS` | `http://localhost:3001,http://localhost:3000` | Allowed CORS origins |

### Development
| Variable | Default | Description |
|----------|---------|-------------|
| `SHOW_ERROR_STACK` | `true` | Show error stack traces |
| `PRISMA_LOG_QUERIES` | `false` | Log Prisma queries |

---

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
SWAGGER_ENABLED=true
LOG_LEVEL=debug
SHOW_ERROR_STACK=true
```

### Production
```env
NODE_ENV=production
SWAGGER_ENABLED=false
LOG_LEVEL=info
SHOW_ERROR_STACK=false
PRISMA_LOG_QUERIES=false
```

### Testing
```env
NODE_ENV=test
SWAGGER_ENABLED=false
LOG_LEVEL=error
```

---

## Security Best Practices

1. **Never commit `.env` to version control**
   - Already in `.gitignore`

2. **Use strong secrets:**
   ```bash
   # Generate JWT secret
   openssl rand -base64 32
   
   # Generate encryption key
   openssl rand -base64 32
   ```

3. **Rotate secrets regularly** (especially in production)

4. **Use different values for each environment**

5. **Restrict access to `.env` file** (file permissions)

6. **Use environment variable management** in production:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets
   - Docker secrets

---

## Validation

The application will:
- ✅ Warn if required variables are missing
- ✅ Use defaults where applicable
- ✅ Fail fast on critical missing variables (database, JWT)

---

## Quick Reference

### Minimum Required for Development
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/elevare
JWT_SECRET=your-secret-key-min-32-chars
NODE_ENV=development
```

### Minimum Required for Production
```env
DATABASE_URL=postgresql://user:pass@host:5432/elevare?sslmode=require
JWT_SECRET=strong-secret-min-32-chars
JWT_REFRESH_SECRET=strong-refresh-secret-min-32-chars
NODE_ENV=production
REDIS_URL=redis://host:6379
ZEPTOMAIL_TOKEN=your-token
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket
ENCRYPTION_KEY=your-32-byte-key-base64
```

---

## Troubleshooting

### "JWT_SECRET is required"
- Set `JWT_SECRET` in `.env`
- Generate: `openssl rand -base64 32`

### "Can't reach database server"
- Check `DATABASE_URL` format
- Verify database is running
- Check network connectivity

### "Redis connection failed"
- Check `REDIS_URL`
- Verify Redis is running
- Check if Redis is required (some features may not work)

### Missing environment variable warnings
- Check `env.example` for all variables
- Set required variables
- Optional variables have defaults

---

## See Also

- `env.example` - Template file
- `IMPLEMENTATION_BRIEF.md` - Full implementation details
- `SETUP.md` - Setup instructions

