# AWS RDS PostgreSQL Setup Guide

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed (optional, but recommended)
- Basic understanding of AWS services

## Step-by-Step Setup

### Step 1: Sign in to AWS Console

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Sign in with your AWS account credentials
3. Select your preferred region (e.g., `us-east-1`, `eu-west-1`)

**💡 Tip:** Choose a region close to your application servers to reduce latency.

---

### Step 2: Navigate to RDS Service

1. In the AWS Console, search for **"RDS"** in the services search bar
2. Click on **"RDS"** to open the RDS Dashboard
3. Click **"Databases"** in the left sidebar
4. Click **"Create database"** button

---

### Step 3: Configure Database Engine

1. **Engine options:**
   - Select **"PostgreSQL"**
   - Choose **Version**: `15.x` or `14.x` (recommended: `15.4` or latest stable)
   - **Templates**: 
     - **Production**: For production workloads (multi-AZ, automated backups)
     - **Dev/Test**: For development/testing (single-AZ, lower cost)
     - **Free tier**: For learning (limited resources, expires after 12 months)

2. **Settings:**
   - **DB instance identifier**: `elevare-db` (or your preferred name)
   - **Master username**: `elevare_admin` (or your preferred username)
   - **Master password**: 
     - Click **"Auto generate a password"** (recommended) OR
     - Enter a strong password manually
     - **⚠️ IMPORTANT:** Save the password! You'll need it for connection.

---

### Step 4: Configure Instance Size

1. **DB instance class:**
   - **Free tier**: `db.t3.micro` or `db.t4g.micro` (1 vCPU, 1 GB RAM)
   - **Development**: `db.t3.small` (2 vCPU, 2 GB RAM) - ~$15/month
   - **Production (small)**: `db.t3.medium` (2 vCPU, 4 GB RAM) - ~$30/month
   - **Production (medium)**: `db.r6g.large` (2 vCPU, 16 GB RAM) - ~$100/month

2. **Storage:**
   - **Storage type**: `General Purpose SSD (gp3)` (recommended)
   - **Allocated storage**: `20 GB` (minimum, can increase later)
   - **Storage autoscaling**: ✅ Enable (recommended)
     - **Maximum storage threshold**: `100 GB` (adjust based on needs)

---

### Step 5: Configure Connectivity

1. **VPC and networking:**
   - **Virtual Private Cloud (VPC)**: Use default VPC or create new
   - **Subnet group**: Use default or create custom
   - **Public access**: 
     - ✅ **Yes** - If connecting from outside AWS (your local machine, external services)
     - ❌ **No** - If only connecting from within AWS (EC2, Lambda, etc.)

2. **VPC security group:**
   - **Create new**: Recommended for first-time setup
   - **Name**: `elevare-db-sg`
   - **Description**: `Security group for Leviate PostgreSQL database`

3. **Availability Zone:**
   - Leave as default (AWS will choose optimal zone)

---

### Step 6: Configure Security Group Rules

**⚠️ CRITICAL:** After creating the database, you MUST configure security group rules.

1. Go to **EC2 Console** → **Security Groups**
2. Find your security group (`elevare-db-sg`)
3. Click **"Edit inbound rules"**
4. Add rule:
   - **Type**: `PostgreSQL`
   - **Protocol**: `TCP`
   - **Port**: `5432`
   - **Source**: 
     - **For development**: `My IP` (your current IP address)
     - **For production**: Your application server's security group ID
     - **For EC2 access**: The security group of your EC2 instance
   - **Description**: `Allow PostgreSQL access from application`

5. Click **"Save rules"**

**🔒 Security Best Practices:**
- Never use `0.0.0.0/0` (all IPs) in production
- Use specific IP addresses or security groups
- Consider using AWS Systems Manager Session Manager for secure access

---

### Step 7: Configure Database Authentication

1. **Database authentication:**
   - **Password authentication**: ✅ Selected (default)
   - **IAM database authentication**: Optional (for advanced use cases)

2. **Initial database name**: `elevare` (optional, can create later)

---

### Step 8: Configure Backup and Maintenance

1. **Backup:**
   - **Automated backups**: ✅ Enable
   - **Backup retention period**: `7 days` (recommended minimum)
   - **Backup window**: Choose low-traffic time (e.g., `03:00-04:00 UTC`)
   - **Copy tags to snapshots**: ✅ Enable

2. **Maintenance:**
   - **Enable auto minor version upgrade**: ✅ Enable (recommended)
   - **Maintenance window**: Choose low-traffic time
   - **Preferred maintenance window**: `sun:04:00-sun:05:00 UTC`

---

### Step 9: Enable Enhanced Monitoring (Optional)

1. **Enhanced monitoring**: 
   - ❌ Disable (for cost savings) OR
   - ✅ Enable (for detailed metrics) - adds ~$2-5/month

2. **Monitoring interval**: `60 seconds` (if enabled)

---

### Step 10: Configure Log Exports (Optional)

1. **Log exports**: 
   - ✅ `postgresql` (recommended for debugging)
   - ✅ `upgrade` (for version upgrades)

---

### Step 11: Review and Create

1. Review all settings
2. **Estimated monthly costs** will be displayed
3. Click **"Create database"**
4. Wait 5-10 minutes for database to be created

---

### Step 12: Save Connection Details

Once the database is created:

1. Click on your database instance name
2. Go to **"Connectivity & security"** tab
3. Note down:
   - **Endpoint**: `elevare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com`
   - **Port**: `5432`
   - **Database name**: `elevare` (or the name you specified)
   - **Username**: `elevare_admin` (or your master username)
   - **Password**: The password you set (or auto-generated one)

4. **If you used auto-generated password:**
   - Click **"Modify"** → **"View credential details"**
   - Copy and save the password securely

---

### Step 13: Update Your .env File

Update your `.env` file in the `elevare` directory:

```env
# AWS RDS PostgreSQL
DATABASE_URL=postgresql://elevare_admin:YOUR_PASSWORD@elevare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/elevare

# Or with SSL (recommended for production)
DATABASE_URL=postgresql://elevare_admin:YOUR_PASSWORD@elevare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/elevare?sslmode=require
```

**Connection String Format:**
```
postgresql://[username]:[password]@[endpoint]:[port]/[database]?sslmode=require
```

---

### Step 14: Test Connection

1. **From your local machine:**
   ```bash
   cd elevare
   npx prisma db pull
   ```

2. **Or using psql:**
   ```bash
   psql -h elevare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com -U elevare_admin -d elevare
   ```

3. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

---

## Security Best Practices

### 1. Enable SSL/TLS (Recommended)

Update your connection string to require SSL:
```env
DATABASE_URL=postgresql://user:pass@endpoint:5432/db?sslmode=require
```

### 2. Use IAM Database Authentication (Advanced)

For enhanced security, use IAM roles instead of passwords:
- Configure IAM authentication in RDS
- Use IAM roles for EC2/Lambda connections
- More secure but requires additional setup

### 3. Network Security

- ✅ Use VPC for database isolation
- ✅ Restrict security group to specific IPs/security groups
- ✅ Use private subnets for production databases
- ✅ Enable VPC Flow Logs for monitoring

### 4. Database Security

- ✅ Use strong passwords (auto-generated recommended)
- ✅ Rotate passwords regularly
- ✅ Enable automated backups
- ✅ Enable encryption at rest
- ✅ Enable encryption in transit (SSL)

---

## Cost Optimization

### Free Tier (12 months)
- **db.t3.micro** or **db.t4g.micro**
- 20 GB storage
- 750 hours/month
- Perfect for development/testing

### Development Environment
- **db.t3.small**: ~$15-20/month
- 20 GB storage: ~$2.30/month
- **Total**: ~$17-22/month

### Production Environment
- **db.t3.medium**: ~$30/month
- 100 GB storage: ~$11.50/month
- Multi-AZ: +100% cost
- **Total**: ~$40-80/month (single-AZ) or ~$80-160/month (multi-AZ)

### Cost-Saving Tips

1. **Use Reserved Instances** (1-3 year commitment): 30-60% savings
2. **Stop instances** when not in use (dev/test only)
3. **Right-size instances** - monitor and adjust
4. **Use Aurora Serverless** for variable workloads
5. **Enable storage autoscaling** to avoid over-provisioning

---

## Monitoring and Maintenance

### CloudWatch Metrics

Monitor these key metrics:
- **CPUUtilization**: Should be < 70%
- **DatabaseConnections**: Monitor connection pool
- **FreeableMemory**: Should have sufficient free memory
- **FreeStorageSpace**: Monitor storage usage
- **ReadLatency/WriteLatency**: Performance metrics

### Automated Backups

- Backups run during the backup window
- Point-in-time recovery available
- Manual snapshots can be created anytime

### Maintenance Windows

- Automatic minor version upgrades
- Planned maintenance notifications
- Can be scheduled during low-traffic periods

---

## Troubleshooting

### Connection Issues

**Error: "Connection timeout"**
- Check security group rules (port 5432)
- Verify public access is enabled (if needed)
- Check VPC routing tables

**Error: "Password authentication failed"**
- Verify username and password
- Check if password was auto-generated (view in console)
- Reset password if needed

**Error: "SSL required"**
- Add `?sslmode=require` to connection string
- Or configure SSL certificate

### Performance Issues

- Check CloudWatch metrics
- Review slow query logs
- Consider upgrading instance size
- Enable Performance Insights (additional cost)

---

## Next Steps

1. ✅ Database created and accessible
2. ✅ Security group configured
3. ✅ Connection string updated in `.env`
4. ✅ Run migrations: `npx prisma migrate dev`
5. ✅ Test application connection
6. ✅ Set up monitoring alerts
7. ✅ Configure automated backups
8. ✅ Document connection details securely

---

## Additional Resources

- [AWS RDS PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [RDS Pricing Calculator](https://calculator.aws/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [Prisma with RDS](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-rds)

---

## Quick Reference: Connection String Template

```env
# Basic
DATABASE_URL=postgresql://[username]:[password]@[endpoint]:5432/[database]

# With SSL (Recommended)
DATABASE_URL=postgresql://[username]:[password]@[endpoint]:5432/[database]?sslmode=require

# With connection pooling (for production)
DATABASE_URL=postgresql://[username]:[password]@[endpoint]:5432/[database]?sslmode=require&connection_limit=10
```

**Example:**
```env
DATABASE_URL=postgresql://elevare_admin:MySecurePass123@elevare-db.abc123xyz.us-east-1.rds.amazonaws.com:5432/elevare?sslmode=require
```

---

## Support

If you encounter issues:
1. Check AWS RDS documentation
2. Review CloudWatch logs
3. Check security group rules
4. Verify network connectivity
5. Review Prisma connection logs

