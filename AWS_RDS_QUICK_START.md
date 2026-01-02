# AWS RDS Quick Start Checklist

## Pre-Setup
- [ ] AWS account created and signed in
- [ ] Selected appropriate AWS region
- [ ] Decided on instance size (dev vs production)

## Database Creation (15-20 minutes)

### Step 1: Create Database
- [ ] Navigate to RDS Console → Create database
- [ ] Select **PostgreSQL** engine
- [ ] Choose version: **15.x** or **14.x**
- [ ] Select template: **Dev/Test** or **Production**

### Step 2: Configuration
- [ ] DB identifier: `elevare-db`
- [ ] Master username: `elevare_admin`
- [ ] Master password: **Auto-generate** (save it!) or set manually
- [ ] Instance class: `db.t3.small` (dev) or `db.t3.medium` (prod)
- [ ] Storage: `20 GB` (minimum)
- [ ] Enable **Storage autoscaling**

### Step 3: Connectivity
- [ ] VPC: Default or custom
- [ ] Public access: **Yes** (if connecting from outside AWS)
- [ ] Create new security group: `elevare-db-sg`
- [ ] Initial database name: `elevare`

### Step 4: Security & Backup
- [ ] Automated backups: **Enable**
- [ ] Backup retention: `7 days`
- [ ] Enable auto minor version upgrade
- [ ] Set maintenance window

### Step 5: Create
- [ ] Review settings
- [ ] Check estimated cost
- [ ] Click **Create database**
- [ ] Wait 5-10 minutes for creation

## Post-Creation (5 minutes)

### Step 6: Security Group Configuration
- [ ] Go to EC2 Console → Security Groups
- [ ] Find `elevare-db-sg`
- [ ] Edit inbound rules
- [ ] Add rule:
  - Type: `PostgreSQL`
  - Port: `5432`
  - Source: `My IP` (dev) or your app's security group (prod)
- [ ] Save rules

### Step 7: Get Connection Details
- [ ] Go to RDS → Your database instance
- [ ] Copy **Endpoint** (e.g., `elevare-db.xxx.us-east-1.rds.amazonaws.com`)
- [ ] Note **Port**: `5432`
- [ ] Note **Username**: `elevare_admin`
- [ ] Get **Password** (if auto-generated, view in console)

### Step 8: Update .env File
```env
DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/elevare?sslmode=require
```

### Step 9: Test Connection
```bash
cd elevare
npx prisma db pull
npx prisma migrate dev --name init
```

## Cost Estimate

### Development
- Instance: `db.t3.small` = ~$15/month
- Storage: 20 GB = ~$2.30/month
- **Total: ~$17-20/month**

### Production (Single-AZ)
- Instance: `db.t3.medium` = ~$30/month
- Storage: 100 GB = ~$11.50/month
- **Total: ~$40-45/month**

### Production (Multi-AZ)
- Instance: `db.t3.medium` = ~$60/month (2x for multi-AZ)
- Storage: 100 GB = ~$11.50/month
- **Total: ~$70-80/month**

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Connection timeout | Check security group allows your IP on port 5432 |
| Password auth failed | Verify password, check if auto-generated |
| SSL required | Add `?sslmode=require` to connection string |
| Database not found | Create database manually or check initial database name |

## Security Checklist
- [ ] Security group restricts access to specific IPs/groups
- [ ] Strong password set (or auto-generated)
- [ ] SSL enabled in connection string (`sslmode=require`)
- [ ] Automated backups enabled
- [ ] Encryption at rest enabled (default)
- [ ] Public access only if needed

## Next Steps
1. [ ] Database created and accessible
2. [ ] Connection tested successfully
3. [ ] Migrations run
4. [ ] Application connects successfully
5. [ ] Monitoring alerts configured (optional)
6. [ ] Backup strategy verified

---

**Need help?** See `AWS_DATABASE_SETUP.md` for detailed instructions.

