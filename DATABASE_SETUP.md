# Database Setup Guide

## Quick Start

### 1. Install PostgreSQL

**Windows:**
- Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
- Or use [Postgres.app](https://postgresapp.com/) for macOS
- Or use Docker: `docker run --name elevare-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=elevare -p 5432:5432 -d postgres`

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

Connect to PostgreSQL:
```bash
psql -U postgres
```

Create database and user:
```sql
CREATE DATABASE elevare;
CREATE USER elevare_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE elevare TO elevare_user;
\q
```

### 3. Configure Environment Variables

Create a `.env` file in the `elevare` directory:

```env
DATABASE_URL=postgresql://elevare_user:your_password@localhost:5432/elevare
```

### 4. Run Migrations

```bash
cd elevare
npx prisma migrate dev --name init
```

This will:
- Create all tables in the database
- Generate Prisma Client
- Create a migration history

### 5. (Optional) Seed Database

If you have seed data:
```bash
npx prisma db seed
```

## Using Docker (Recommended for Development)

### Quick Start with Docker Compose

Create `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: elevare-postgres
    environment:
      POSTGRES_USER: elevare_user
      POSTGRES_PASSWORD: elevare_password
      POSTGRES_DB: elevare
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U elevare_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: elevare-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start services:
```bash
docker-compose up -d
```

Your `.env` file:
```env
DATABASE_URL=postgresql://elevare_user:elevare_password@localhost:5432/elevare
REDIS_URL=redis://localhost:6379
```

## Verify Connection

Test the connection:
```bash
npx prisma db pull
```

Or check connection in your app - it should log "Database connected successfully" on startup.

## Troubleshooting

### Error: "Can't reach database server"

1. **Check if PostgreSQL is running:**
   ```bash
   # Windows
   Get-Service postgresql*
   
   # macOS/Linux
   brew services list
   # or
   sudo systemctl status postgresql
   ```

2. **Check connection string format:**
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```

3. **Test connection manually:**
   ```bash
   psql -h localhost -U elevare_user -d elevare
   ```

### Error: "database does not exist"

Create the database:
```sql
CREATE DATABASE elevare;
```

### Error: "password authentication failed"

Check your username and password in the DATABASE_URL.

### Reset Database (Development Only)

⚠️ **WARNING: This will delete all data!**

```bash
npx prisma migrate reset
```

This will:
- Drop the database
- Create a new database
- Run all migrations
- Run seed scripts (if any)

## Production Considerations

1. **Use connection pooling** (Prisma handles this automatically)
2. **Set up SSL** for database connections
3. **Use environment-specific connection strings**
4. **Set up database backups**
5. **Monitor database performance**

## Next Steps

After database setup:
1. Run migrations: `npx prisma migrate dev`
2. Start the server: `npm run start:dev`
3. Access Swagger: `http://localhost:3000/api/docs`

