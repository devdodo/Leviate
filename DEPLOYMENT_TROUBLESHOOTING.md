# Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. npm Install Peer Dependency Conflicts

#### Error:
```
ERESOLVE could not resolve
While resolving: @nestjs/swagger@7.1.17
Found: reflect-metadata@0.2.2
Could not resolve dependency:
peer reflect-metadata@"^0.1.12" from @nestjs/swagger@7.1.17
```

#### Solution:

**Option 1: Use --legacy-peer-deps (Recommended)**
```bash
npm install --production --legacy-peer-deps
```

**Option 2: Create .npmrc file**
Create a `.npmrc` file in the project root:
```
legacy-peer-deps=true
```

Then run:
```bash
npm install --production
```

**Option 3: Use --force (Not recommended)**
```bash
npm install --production --force
```

#### Why This Happens:
- `@nestjs/swagger@7.1.17` requires `reflect-metadata@^0.1.12`
- The project uses `reflect-metadata@^0.2.0` (compatible with NestJS 10)
- npm's strict peer dependency resolution flags this as a conflict
- `--legacy-peer-deps` uses npm's older, more lenient resolution algorithm

---

### 2. Prisma Client Not Generated

#### Error:
```
Property 'withdrawalOtp' does not exist on type 'PrismaService'
```

#### Solution:
```bash
# Generate Prisma client
npx prisma generate

# If file is locked, stop server first
pm2 stop leviate-api
npx prisma generate
pm2 start leviate-api
```

---

### 3. Database Connection Failed

#### Error:
```
PrismaClientInitializationError: Can't reach database server
```

#### Solutions:

**Check Database URL:**
```bash
# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

**Test Connection:**
```bash
# Test PostgreSQL connection
psql "postgresql://user:password@host:5432/database?sslmode=require"
```

**Check Security Groups (AWS RDS):**
- Ensure EC2 security group can access RDS security group
- Verify RDS is publicly accessible (if needed)
- Check VPC and subnet configurations

---

### 4. Caddy SSL Certificate Issues

#### Error:
```
Certificate not obtained: acme: error: 403
```

#### Solutions:

**Check DNS:**
```bash
# Verify DNS points to EC2
dig api.yourdomain.com
nslookup api.yourdomain.com
```

**Check Caddyfile:**
```bash
# Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile
```

**Check Ports:**
```bash
# Ensure ports 80 and 443 are open
sudo ufw status
sudo netstat -tulpn | grep -E ':(80|443)'
```

**Force Certificate Renewal:**
```bash
sudo systemctl reload caddy
sudo caddy reload --config /etc/caddy/Caddyfile
```

---

### 5. Application Not Starting

#### Check PM2 Logs:
```bash
pm2 logs leviate-api --lines 50
pm2 logs leviate-api --err --lines 50
```

#### Check Application Status:
```bash
pm2 status
pm2 info leviate-api
```

#### Common Issues:

**Port Already in Use:**
```bash
# Check what's using port 3000
sudo lsof -i :3000
# Kill process if needed
sudo kill -9 <PID>
```

**Missing Environment Variables:**
```bash
# Check .env file exists and has all required variables
cat .env
```

**Build Errors:**
```bash
# Rebuild application
npm run build
# Check for TypeScript errors
npm run build 2>&1 | grep -i error
```

---

### 6. Permission Denied Errors

#### Error:
```
EACCES: permission denied, mkdir '/var/www/Leviate/node_modules'
Error: The operation was rejected by your operating system.
It is likely you do not have the permissions to access this file as the current user
```

#### Solution:

**Fix Directory Ownership:**
```bash
# Change ownership of the entire project directory
sudo chown -R ubuntu:ubuntu /var/www/Leviate

# Or if your project is in a subdirectory:
sudo chown -R ubuntu:ubuntu /var/www/Leviate/elevare

# Verify ownership
ls -la /var/www/Leviate
```

**Fix Permissions:**
```bash
# Set proper directory permissions
sudo chmod -R 755 /var/www/Leviate
sudo chmod 600 /var/www/Leviate/elevare/.env  # Secure .env file
```

**Then retry npm install:**
```bash
cd /var/www/Leviate/elevare
npm install --production --legacy-peer-deps
```

#### Why This Happens:
- Directories created with `sudo` are owned by `root`
- `npm install` needs write permissions to create `node_modules`
- The `ubuntu` user needs ownership of the project directory

---

### 7. Out of Memory Errors

#### Error:
```
JavaScript heap out of memory
```

#### Solution:

**Increase Node.js Memory:**
```bash
# Edit PM2 ecosystem file
nano ecosystem.config.js
```

Add to app config:
```javascript
node_args: '--max-old-space-size=2048'
```

Then restart:
```bash
pm2 restart leviate-api
```

**Or upgrade EC2 instance** to one with more RAM.

---

### 8. Git Clone Issues

#### Error:
```
Permission denied (publickey)
```

#### Solution:

**Use HTTPS instead:**
```bash
git clone https://github.com/username/repo.git
```

**Or set up SSH keys:**
```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Add to GitHub/GitLab
cat ~/.ssh/id_rsa.pub
# Copy and add to your Git provider
```

---

### 9. Caddy Not Starting

#### Check Status:
```bash
sudo systemctl status caddy
```

#### Check Logs:
```bash
sudo journalctl -u caddy -n 50
```

#### Common Fixes:

**Invalid Caddyfile:**
```bash
# Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Fix syntax errors
sudo nano /etc/caddy/Caddyfile
```

**Port Already in Use:**
```bash
# Check if another service is using ports 80/443
sudo lsof -i :80
sudo lsof -i :443
```

---

### 10. Database Migration Failures

#### Error:
```
Migration failed to apply
```

#### Solution:

**Check Migration Status:**
```bash
npx prisma migrate status
```

**Apply Migrations Manually:**
```bash
# Apply pending migrations
npx prisma migrate deploy

# If migration is stuck, mark as applied
npx prisma migrate resolve --applied <migration-name>
```

**Reset Database (Development Only):**
```bash
# WARNING: This deletes all data!
npx prisma migrate reset
```

---

### 11. Prisma Version Mismatch

#### Error:
```
Error: The datasource property `url` is no longer supported in schema files.
Prisma CLI Version : 7.2.0
```

#### Problem:
You have Prisma 7.x installed globally, but the project uses Prisma 5.19.1. Prisma 7 has breaking changes.

#### Solution:

**Option 1: Use Local Prisma Binary (Recommended)**
```bash
# Ensure you're in the project directory
cd /var/www/Leviate/elevare

# IMPORTANT: Install dependencies first
npm install --production --legacy-peer-deps

# Use the local Prisma binary directly
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma migrate deploy

# Verify you're using the correct version
./node_modules/.bin/prisma --version
# Should show: prisma 5.19.1
```

**Option 2: Use npx with Version Specified**
```bash
cd /var/www/Leviate/elevare

# Install dependencies first
npm install --production --legacy-peer-deps

# Force npx to use Prisma 5.19.1
npx --yes prisma@5.19.1 generate
npx --yes prisma@5.19.1 migrate deploy
```

**Option 2: Uninstall Global Prisma 7**
```bash
# Check if Prisma is installed globally
npm list -g prisma

# If Prisma 7 is installed globally, uninstall it
sudo npm uninstall -g prisma

# Now use local version
npx prisma generate
```

**Option 3: Use npm scripts**
```bash
# Use the npm scripts defined in package.json
npm run prisma:generate
# Or
npx prisma generate
```

#### Verify Correct Version:
```bash
# Check local Prisma version
npx prisma --version

# Should match package.json version (5.19.1)
# If it shows 7.x, the global version is being used
```

#### Why This Happens:
- Prisma 7 changed the schema format (moved datasource URL to config file)
- Your project uses Prisma 5.19.1 (as defined in package.json)
- `npx` should use the local version, but if Prisma 7 is globally installed, it might take precedence

---

## Quick Diagnostic Commands

```bash
# Check all services
pm2 status
sudo systemctl status caddy
sudo systemctl status postgresql  # if local

# Check ports
sudo netstat -tulpn | grep -E ':(3000|80|443|5432)'

# Check disk space
df -h

# Check memory
free -h

# Check logs
pm2 logs leviate-api --lines 20
sudo journalctl -u caddy -n 20

# Test database
npx prisma db pull

# Test API
curl http://localhost:3000/api/health
curl https://api.yourdomain.com/api/health
```

---

## Getting Help

1. **Check Logs First:**
   - Application: `pm2 logs leviate-api`
   - Caddy: `sudo journalctl -u caddy`
   - System: `sudo journalctl -xe`

2. **Verify Configuration:**
   - `.env` file has all required variables
   - Caddyfile syntax is correct
   - DNS points to correct IP
   - Security groups allow necessary traffic

3. **Common Solutions:**
   - Restart services: `pm2 restart all && sudo systemctl restart caddy`
   - Regenerate Prisma client: `npx prisma generate`
   - Rebuild application: `npm run build`

