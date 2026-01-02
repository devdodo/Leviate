# Deployment Guide: NestJS Service to AWS EC2 with Caddy SSL

This guide covers deploying the Leviate backend service to an AWS EC2 instance with SSL using Caddy.

## Prerequisites

- AWS Account with EC2 access
- Domain name (for SSL certificate)
- SSH key pair for EC2 access
- PostgreSQL database (AWS RDS or external)

---

## Step 1: Launch EC2 Instance

### 1.1 Create EC2 Instance

1. **Go to AWS Console** → EC2 → Launch Instance
2. **Choose AMI**: Ubuntu Server 22.04 LTS (or latest LTS)
3. **Instance Type**: 
   - Development: `t3.small` (2 vCPU, 2 GB RAM)
   - Production: `t3.medium` or `t3.large` (2-4 vCPU, 4-8 GB RAM)
4. **Key Pair**: Create or select existing SSH key pair
5. **Network Settings**:
   - Allow SSH (port 22) from your IP
   - Allow HTTP (port 80) from anywhere
   - Allow HTTPS (port 443) from anywhere
6. **Storage**: 20 GB minimum (SSD)
7. **Launch Instance**

### 1.2 Configure Security Group

After launch, edit Security Group to allow:
- **Inbound Rules**:
  - SSH (22) - Your IP only
  - HTTP (80) - 0.0.0.0/0
  - HTTPS (443) - 0.0.0.0/0
  - Custom TCP (3000) - 127.0.0.1/32 (for local access only)

---

## Step 2: Connect to EC2 Instance

### 2.1 SSH into Instance

```bash
# Replace with your key and instance details
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip
```

### 2.2 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Step 3: Install Dependencies

### 3.1 Install Node.js (using NodeSource)

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version
```

### 3.2 Install PostgreSQL Client (for database migrations)

```bash
sudo apt install -y postgresql-client
```

### 3.3 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 3.4 Install Git

```bash
sudo apt install -y git
```

---

## Step 4: Install and Configure Caddy

### 4.1 Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 4.2 Verify Caddy Installation

```bash
caddy version
```

---

## Step 5: Set Up Application

### 5.1 Clone Repository

```bash
# Create app directory
sudo mkdir -p /var/www
cd /var/www

# Clone your repository (replace with your repo URL)
sudo git clone https://github.com/your-username/elevare.git

# Fix ownership - IMPORTANT: Do this before npm install
sudo chown -R ubuntu:ubuntu /var/www/elevare

# Navigate to the NestJS application directory
# IMPORTANT: Your repo structure is: /var/www/elevare/elevare/
cd /var/www/elevare/elevare

# Verify you're in the right directory
ls -la
# Should see: prisma/, src/, package.json, tsconfig.json

# Or if you're uploading files directly:
# sudo mkdir -p /var/www/elevare/elevare
# sudo chown -R ubuntu:ubuntu /var/www/elevare
# Upload your files via SCP or SFTP
```

### 5.2 Install Application Dependencies

```bash
# IMPORTANT: Make sure you're in the elevare subdirectory
cd /var/www/elevare/elevare

# Verify you're in the right place
ls -la prisma/schema.prisma
# Should show the file, not an error

# Install with legacy peer deps to resolve reflect-metadata conflict
npm install --production --legacy-peer-deps

# Or if installing all dependencies (including dev):
npm install --legacy-peer-deps
```

### 5.3 Build Application

```bash
npm run build
```

---

## Step 6: Configure Environment Variables

### 6.1 Create .env File

```bash
sudo nano /var/www/elevare/elevare/.env
```

### 6.2 Add Environment Variables

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_PREFIX=api
APP_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database (AWS RDS)
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/postgres?sslmode=require

# JWT
JWT_SECRET=your-production-jwt-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-production-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# Zeptomail
ZEPTOMAIL_TOKEN=your-zeptomail-token
ZEPTOMAIL_BOUNCE_ADDRESS=
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Leviate

# Redis (if using)
REDIS_URL=redis://localhost:6379

# Encryption
ENCRYPTION_KEY=your-base64-32-byte-key

# Paystack
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key

# AWS S3 (if using)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# AI Service
OPENAI_API_KEY=your-openai-key
# OR
ANTHROPIC_API_KEY=your-anthropic-key

# Swagger (disable in production)
SWAGGER_ENABLED=false
```

### 6.3 Secure .env File

```bash
sudo chmod 600 /var/www/elevare/elevare/.env
sudo chown ubuntu:ubuntu /var/www/elevare/elevare/.env
```

---

## Step 7: Set Up Database

### 7.1 Run Database Migrations

```bash
cd /var/www/elevare/elevare

# IMPORTANT: Install dependencies first to get local Prisma
npm install --production --legacy-peer-deps

# Use local Prisma binary (ensures correct version)
./node_modules/.bin/prisma generate

# Run migrations
./node_modules/.bin/prisma migrate deploy

# Seed database (if needed)
npm run seed
```

**Alternative:** If you prefer using npx, specify the version:
```bash
npx --yes prisma@5.19.1 generate
npx --yes prisma@5.19.1 migrate deploy
```

**Note:** `npx prisma` may download Prisma 7.x from the registry. Always use the local binary (`./node_modules/.bin/prisma`) or specify the version (`prisma@5.19.1`) to ensure compatibility.

### 7.2 Verify Database Connection

```bash
# Test connection
npx prisma db pull
```

---

## Step 8: Configure PM2

### 8.1 Create PM2 Ecosystem File

```bash
sudo nano /var/www/elevare/elevare/ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'leviate-api',
      script: 'dist/main.js',
      cwd: '/var/www/elevare/elevare',
      instances: 2, // Use 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/leviate-error.log',
      out_file: '/var/log/pm2/leviate-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
    },
  ],
};
```

### 8.2 Create Log Directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown ubuntu:ubuntu /var/log/pm2
```

### 8.3 Start Application with PM2

```bash
cd /var/www/elevare/elevare
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Follow the command it outputs to enable PM2 on system boot
```

### 8.4 Verify PM2 Status

```bash
pm2 status
pm2 logs leviate-api
```

---

## Step 9: Configure Caddy Reverse Proxy

### 9.1 Create Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

Add:

```caddy
api.yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # Logging
    log {
        output file /var/log/caddy/api.log
        format json
    }
}

# Optional: Redirect www to non-www
www.api.yourdomain.com {
    redir https://api.yourdomain.com{uri} permanent
}
```

**Important**: Replace `api.yourdomain.com` with your actual domain.

### 9.2 Test Caddy Configuration

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

### 9.3 Start Caddy

```bash
sudo systemctl start caddy
sudo systemctl enable caddy
sudo systemctl status caddy
```

### 9.4 Check Caddy Logs

```bash
sudo journalctl -u caddy -f
```

---

## Step 10: DNS Configuration

### 10.1 Configure DNS Records

In your domain registrar's DNS settings, add:

```
Type: A
Name: api (or @ for root domain)
Value: your-ec2-public-ip
TTL: 300
```

### 10.2 Verify DNS Propagation

```bash
# Check DNS resolution
dig api.yourdomain.com
nslookup api.yourdomain.com
```

---

## Step 11: SSL Certificate (Automatic with Caddy)

Caddy automatically obtains and renews SSL certificates via Let's Encrypt.

### 11.1 Verify SSL Certificate

After DNS propagates (may take a few minutes):

```bash
# Check certificate status
sudo caddy list-certificates

# Test HTTPS
curl -I https://api.yourdomain.com
```

### 11.2 Force Certificate Renewal (if needed)

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

---

## Step 12: Firewall Configuration

### 12.1 Configure UFW (Uncomplicated Firewall)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS (Caddy handles these)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## Step 13: Application Monitoring

### 13.1 PM2 Monitoring

```bash
# View real-time logs
pm2 logs leviate-api

# Monitor resources
pm2 monit

# View process info
pm2 info leviate-api
```

### 13.2 Set Up Log Rotation

```bash
sudo nano /etc/logrotate.d/pm2
```

Add:

```
/var/log/pm2/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Step 14: Health Check Endpoint

Verify your application is running:

```bash
# Check health endpoint (if you have one)
curl http://localhost:3000/api/health

# Or check via HTTPS
curl https://api.yourdomain.com/api/health
```

---

## Step 15: Security Hardening

### 15.1 Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 15.2 Set Up Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 15.3 Regular Updates

```bash
# Set up automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Step 16: Backup Strategy

### 16.1 Database Backups

Create a backup script:

```bash
sudo nano /usr/local/bin/backup-db.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD="your-password" pg_dump -h your-rds-endpoint -U username -d postgres > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

Add to crontab:

```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-db.sh
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs leviate-api --lines 50

# Check application logs
tail -f /var/log/pm2/leviate-error.log

# Restart application
pm2 restart leviate-api
```

### Caddy Not Starting

```bash
# Check Caddy status
sudo systemctl status caddy

# Check Caddy logs
sudo journalctl -u caddy -n 50

# Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo caddy list-certificates

# Force reload
sudo systemctl reload caddy

# Check DNS
dig api.yourdomain.com
```

### Database Connection Issues

```bash
# Test database connection
psql "postgresql://username:password@host:5432/postgres?sslmode=require"

# Check security groups (AWS RDS)
# Ensure EC2 security group can access RDS security group
```

---

## Maintenance Commands

### Update Application

```bash
cd /var/www/elevare/elevare
git pull origin main
npm install --production --legacy-peer-deps
npm run build
npx prisma generate
npx prisma migrate deploy
pm2 restart leviate-api
```

### View Logs

```bash
# Application logs
pm2 logs leviate-api

# Caddy logs
sudo tail -f /var/log/caddy/api.log

# System logs
sudo journalctl -u caddy -f
```

### Restart Services

```bash
# Restart application
pm2 restart leviate-api

# Restart Caddy
sudo systemctl restart caddy

# Restart everything
pm2 restart all && sudo systemctl restart caddy
```

---

## Quick Reference

| Service | Command |
|---------|---------|
| PM2 Status | `pm2 status` |
| PM2 Logs | `pm2 logs leviate-api` |
| PM2 Restart | `pm2 restart leviate-api` |
| Caddy Status | `sudo systemctl status caddy` |
| Caddy Reload | `sudo systemctl reload caddy` |
| Caddy Logs | `sudo journalctl -u caddy -f` |
| Check SSL | `curl -I https://api.yourdomain.com` |

---

## Next Steps

1. ✅ Set up monitoring (CloudWatch, DataDog, etc.)
2. ✅ Configure alerts for downtime
3. ✅ Set up CI/CD pipeline
4. ✅ Configure CDN (CloudFront) if needed
5. ✅ Set up database read replicas for scaling
6. ✅ Configure auto-scaling groups for high availability

---

## Support

For issues, check:
- Application logs: `/var/log/pm2/`
- Caddy logs: `/var/log/caddy/`
- System logs: `sudo journalctl -u caddy`

