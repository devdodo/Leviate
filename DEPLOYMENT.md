# Complete Deployment Guide: Leviate API to AWS EC2 with Caddy SSL

This guide covers deploying the Leviate NestJS backend service to AWS EC2 with automatic SSL using Caddy.

---

## Prerequisites

- AWS Account with EC2 access
- Domain name (for SSL certificate)
- SSH key pair for EC2 access
- PostgreSQL database (AWS RDS or external)
- Git repository access

---

## Part 1: AWS EC2 Instance Setup

### Step 1.1: Launch EC2 Instance

1. **Go to AWS Console** → EC2 → Launch Instance

2. **Configure Instance:**
   - **Name**: `leviate-api-production`
   - **AMI**: Ubuntu Server 22.04 LTS (or latest LTS)
   - **Instance Type**: 
     - Development: `t3.small` (2 vCPU, 2 GB RAM)
     - Production: `t3.medium` or `t3.large` (2-4 vCPU, 4-8 GB RAM)
   - **Key Pair**: Create or select existing SSH key pair
   - **Network Settings**:
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere (0.0.0.0/0)
     - Allow HTTPS (port 443) from anywhere (0.0.0.0/0)
   - **Storage**: 20 GB minimum (SSD)
   - **Launch Instance**

### Step 1.2: Configure Security Group

After launch, edit Security Group:

**Inbound Rules:**
- SSH (22) - Your IP only
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0

**Outbound Rules:**
- All traffic - 0.0.0.0/0

### Step 1.3: Allocate Elastic IP (Optional but Recommended)

1. Go to EC2 → Elastic IPs → Allocate Elastic IP
2. Associate with your EC2 instance
3. **Note the Elastic IP** - you'll use this for DNS

---

## Part 2: Connect and Initial Server Setup

### Step 2.1: Connect to EC2 Instance

```bash
# Replace with your key and instance details
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip
```

### Step 2.2: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2.3: Install Basic Tools

```bash
sudo apt install -y git curl wget build-essential
```

---

## Part 3: Install Dependencies

### Step 3.1: Install Node.js 20.x LTS

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version
```

### Step 3.2: Install PostgreSQL Client

```bash
sudo apt install -y postgresql-client
```

### Step 3.3: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Step 3.4: Install Caddy

```bash
# Add Caddy repository
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Install Caddy
sudo apt update
sudo apt install caddy

# Verify installation
caddy version
```

---

## Part 4: Deploy Application

### Step 4.1: Clone Repository

```bash
# Create app directory
sudo mkdir -p /var/www
cd /var/www

# Clone your repository
sudo git clone https://github.com/your-username/Leviate.git
cd Leviate

# Fix ownership - IMPORTANT: Do this before npm install
sudo chown -R ubuntu:ubuntu /var/www/Leviate

# Navigate to the NestJS application directory
cd elevare
```

### Step 4.2: Install Application Dependencies

```bash
# Make sure you're in the elevare directory
pwd
# Should show: /var/www/Leviate/elevare

# Verify key files exist
ls -la package.json prisma/schema.prisma

# Install dependencies
npm install --production --legacy-peer-deps
```

### Step 4.3: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add all required environment variables:

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

# Encryption
ENCRYPTION_KEY=your-base64-32-byte-key

# Paystack
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key

# Swagger (disable in production or enable with authentication)
SWAGGER_ENABLED=false

# Add all other required variables from env.example
```

```bash
# Secure .env file
chmod 600 .env
```

### Step 4.4: Set Up Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database (optional - creates super admin)
npm run seed
```

### Step 4.5: Build Application

```bash
# Build the application
npm run build

# Verify build was successful
ls -la dist/main.js
# Should show the compiled JavaScript file
```

---

## Part 5: Configure PM2

### Step 5.1: Create Log Directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown ubuntu:ubuntu /var/log/pm2
```

### Step 5.2: Start Application with PM2

The `ecosystem.config.js` file is already in the repository. Start the application:

```bash
# Make sure you're in the elevare directory
cd /var/www/Leviate/elevare

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 on system boot
pm2 startup
# Follow the command it outputs (usually: sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu)
```

### Step 5.3: Verify PM2 Status

```bash
# Check status
pm2 status
# Should show: leviate-api | online

# View logs
pm2 logs leviate-api --lines 20

# Test application
curl http://localhost:3000/api/health
# Should return JSON response
```

---

## Part 6: Configure Caddy Reverse Proxy

### Step 6.1: Configure DNS

**In your domain registrar's DNS settings**, add an A record:

```
Type: A
Name: api (or @ for root domain)
Value: your-ec2-elastic-ip (or public IP)
TTL: 300 (5 minutes)
```

**Verify DNS:**
```bash
# Check DNS resolution (from your local machine)
dig api.yourdomain.com
nslookup api.yourdomain.com
# Should return your EC2 IP address
```

### Step 6.2: Create Caddyfile

```bash
# Copy Caddyfile from repository
sudo cp /var/www/Leviate/elevare/Caddyfile /etc/caddy/Caddyfile

# Edit and update domain name
sudo nano /etc/caddy/Caddyfile
```

**Replace `api.yourdomain.com` with your actual domain** (e.g., `backend.leviateapp.com`)

**Or use sed to replace automatically:**
```bash
sudo sed -i 's/api.yourdomain.com/backend.leviateapp.com/g' /etc/caddy/Caddyfile

# Verify the change
sudo cat /etc/caddy/Caddyfile | grep backend.leviateapp.com
```

### Step 6.3: Validate Caddy Configuration

```bash
# Test the Caddyfile syntax
sudo caddy validate --config /etc/caddy/Caddyfile
```

### Step 6.4: Start Caddy

```bash
# Start Caddy
sudo systemctl start caddy

# Enable Caddy on boot
sudo systemctl enable caddy

# Check status
sudo systemctl status caddy
```

### Step 6.5: Verify SSL Certificate

Caddy automatically obtains SSL certificate from Let's Encrypt:

```bash
# Check certificate status
sudo caddy list-certificates

# View Caddy logs
sudo journalctl -u caddy -f

# Test HTTPS
curl -I https://api.yourdomain.com/api/health
# Should return 200 OK with SSL certificate
```

---

## Part 7: Configure Firewall

### Step 7.1: Configure UFW (Uncomplicated Firewall)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS (Caddy handles these)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 8: Verify Deployment

### Step 8.1: Test API Endpoints

```bash
# Test health endpoint
curl https://api.yourdomain.com/api/health

# Test Swagger (if enabled)
curl https://api.yourdomain.com/api/docs
# Or visit in browser: https://api.yourdomain.com/api/docs
```

### Step 8.2: Check All Services

```bash
# Check PM2
pm2 status
pm2 logs leviate-api --lines 10

# Check Caddy
sudo systemctl status caddy
sudo journalctl -u caddy -n 20

# Check application is listening
sudo netstat -tulpn | grep 3000
# Should show: tcp 0.0.0.0:3000 LISTEN
```

---

## Part 9: Enable Swagger (Optional)

If you want to enable Swagger in production:

```bash
# Edit .env file
nano /var/www/Leviate/elevare/.env

# Add or update:
SWAGGER_ENABLED=true

# Restart application
pm2 restart leviate-api

# Access Swagger
# Browser: https://api.yourdomain.com/api/docs
```

---

## Part 10: Security Hardening

### Step 10.1: Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### Step 10.2: Set Up Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Step 10.3: Set Up Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Part 11: Monitoring and Maintenance

### Step 11.1: Set Up Log Rotation

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

### Step 11.2: Monitor Application

```bash
# View real-time logs
pm2 logs leviate-api

# Monitor resources
pm2 monit

# View process info
pm2 info leviate-api
```

---

## Part 12: Updating the Application

### Step 12.1: Deployment Script

Use the included deployment script:

```bash
cd /var/www/Leviate/elevare
./scripts/deploy.sh
```

### Step 12.2: Manual Update Process

```bash
# Navigate to application directory
cd /var/www/Leviate/elevare

# Pull latest code
git pull origin main

# Install dependencies
npm install --production --legacy-peer-deps

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Build application
npm run build

# Restart application
pm2 restart leviate-api

# Verify
pm2 status
pm2 logs leviate-api --lines 20
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs leviate-api --err --lines 50

# Check if port is in use
sudo lsof -i :3000

# Restart application
pm2 restart leviate-api
```

### Caddy Not Working

```bash
# Check Caddy status
sudo systemctl status caddy

# Check Caddy logs
sudo journalctl -u caddy -n 50

# Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy (reload may not work)
sudo systemctl restart caddy

# Alternative: Use Caddy's reload command
sudo caddy reload --config /etc/caddy/Caddyfile
```

### Caddy Showing Default Page

If you see the Caddy welcome page instead of your API:

```bash
# Check current Caddyfile
sudo cat /etc/caddy/Caddyfile

# If it shows default config (with :80), replace it
sudo cp /var/www/Leviate/elevare/Caddyfile /etc/caddy/Caddyfile

# Update domain name to backend.leviateapp.com
sudo sed -i 's/api.yourdomain.com/backend.leviateapp.com/g' /etc/caddy/Caddyfile

# Validate and reload
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### HTTPS Not Working

If HTTP works but HTTPS doesn't:

```bash
# 1. Check DNS points to EC2 IP
dig backend.leviateapp.com
# Should return your EC2 public IP or Elastic IP

# 2. Check security group allows port 443
# In AWS Console: EC2 → Security Groups → Inbound Rules
# Should have: HTTPS (443) from 0.0.0.0/0

# 3. Check firewall
sudo ufw status
sudo ufw allow 443/tcp

# 4. Check Caddy logs for SSL errors
sudo journalctl -u caddy | grep -i "certificate\|tls\|ssl"

# 5. Check certificate status
sudo caddy list-certificates
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo caddy list-certificates

# Check DNS
dig api.yourdomain.com

# Force reload
sudo systemctl reload caddy
```

### Database Connection Issues

```bash
# Test database connection
psql "postgresql://user:password@host:5432/postgres?sslmode=require"

# Check security groups (AWS RDS)
# Ensure EC2 security group can access RDS security group
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Check PM2 status | `pm2 status` |
| View PM2 logs | `pm2 logs leviate-api` |
| Restart app | `pm2 restart leviate-api` |
| Check Caddy status | `sudo systemctl status caddy` |
| Reload Caddy | `sudo systemctl reload caddy` |
| View Caddy logs | `sudo journalctl -u caddy -f` |
| Test API | `curl https://api.yourdomain.com/api/health` |
| Check SSL | `curl -I https://api.yourdomain.com/api/health` |

---

## Production Checklist

- [ ] EC2 instance launched and configured
- [ ] Security groups allow ports 22, 80, 443
- [ ] Node.js 20.x installed
- [ ] PM2 installed and configured
- [ ] Caddy installed
- [ ] Application cloned and dependencies installed
- [ ] Environment variables configured in `.env`
- [ ] Database migrations applied
- [ ] Application built successfully
- [ ] PM2 running application
- [ ] DNS A record points to EC2 IP
- [ ] Caddyfile configured with correct domain
- [ ] SSL certificate obtained automatically
- [ ] Firewall configured
- [ ] Application accessible via HTTPS
- [ ] Swagger accessible (if enabled)
- [ ] Logs are being written
- [ ] Monitoring set up

---

## Next Steps

1. Set up monitoring (CloudWatch, DataDog, etc.)
2. Configure alerts for downtime
3. Set up CI/CD pipeline
4. Configure database backups
5. Set up database read replicas (if needed)
6. Configure auto-scaling groups (for high availability)

---

## Support

For issues:
- Check application logs: `pm2 logs leviate-api`
- Check Caddy logs: `sudo journalctl -u caddy`
- Check system logs: `sudo journalctl -xe`
- Verify DNS: `dig api.yourdomain.com`
- Test locally: `curl http://localhost:3000/api/health`

