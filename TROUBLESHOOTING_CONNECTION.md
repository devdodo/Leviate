# Database Connection Troubleshooting Guide

## Current Error
```
Can't reach database server at `elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432`
```

## Step-by-Step Diagnosis

### Step 1: Verify RDS Instance Status

1. Go to **AWS RDS Console** → **Databases**
2. Click on `elevare-staging-db`
3. Check **Status**: Should be **"Available"** (not "Modifying", "Creating", etc.)
4. Check **Public accessibility**: Should show **"Yes"**

**If status is "Modifying":**
- Wait 5-10 minutes for changes to complete
- Refresh the page to check status

**If public accessibility is "No":**
- Click **"Modify"**
- Change to **"Publicly accessible"**
- Apply immediately
- Wait for modification to complete

---

### Step 2: Verify Security Group Configuration

1. In RDS Console → Your DB → **"Connectivity & security"** tab
2. Note the **VPC security groups** (e.g., `sg-xxxxxxxxx`)
3. Go to **EC2 Console** → **Security Groups**
4. Find the security group ID from step 2
5. Click on it → **"Inbound rules"** tab

**Check if rule exists:**
- ✅ Should have a rule for **PostgreSQL** on port **5432**
- ✅ Source should be your IP address (e.g., `123.45.67.89/32`)

**If rule doesn't exist or is wrong:**
1. Click **"Edit inbound rules"**
2. Click **"Add rule"**
3. Configure:
   - **Type**: `PostgreSQL`
   - **Protocol**: `TCP`
   - **Port range**: `5432`
   - **Source**: 
     - Click **"My IP"** button (recommended)
     - OR enter your IP manually: `Your.IP.Address/32`
   - **Description**: `Allow PostgreSQL access`
4. Click **"Save rules"**

**⚠️ Important:** If your IP changes (different network, VPN, etc.), you'll need to update the security group rule.

---

### Step 3: Test Network Connectivity

Test if you can reach the database server:

**Windows (PowerShell):**
```powershell
Test-NetConnection -ComputerName elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com -Port 5432
```

**Windows (Command Prompt):**
```cmd
telnet elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com 5432
```

**macOS/Linux:**
```bash
nc -zv elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com 5432
# or
telnet elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com 5432
```

**Expected result:**
- ✅ **Connection successful** = Network is reachable, check credentials
- ❌ **Connection timeout** = Security group or public access issue
- ❌ **Connection refused** = Port might be blocked

---

### Step 4: Verify Connection String

Check your `.env` file in the `elevare` directory:

```env
DATABASE_URL=postgresql://elevare_admin:v8qkQnzMJjqm401JEz7e@elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com:5432/elevare?sslmode=require
```

**Verify:**
- ✅ Username is correct: `elevare_admin`
- ✅ Password is correct (check if it was auto-generated)
- ✅ Host/endpoint is correct
- ✅ Port is `5432`
- ✅ Database name is `elevare`
- ✅ SSL mode is set (if required)

**If password was auto-generated:**
1. Go to RDS Console → Your DB
2. Click **"Modify"**
3. Scroll to **"Master password"**
4. Click **"View credential details"** (if available)
5. Copy the password

**To reset password:**
1. RDS Console → Your DB → **"Modify"**
2. Change master password
3. Apply immediately
4. Update `.env` file

---

### Step 5: Test with Prisma

Run the test script:

```bash
cd elevare
node test-db-connection.js
```

Or test directly:

```bash
npx prisma db pull
```

---

### Step 6: Check VPC Configuration (Advanced)

If using custom VPC:

1. **Check Subnet Group:**
   - RDS → Your DB → **"Connectivity & security"** → **"Subnet group"**
   - Ensure it includes public subnets

2. **Check Route Tables:**
   - VPC Console → **Route Tables**
   - Find route table for public subnets
   - Should have: `0.0.0.0/0` → `igw-xxxxx` (Internet Gateway)

3. **Check Network ACLs:**
   - VPC Console → **Network ACLs**
   - Ensure inbound/outbound rules allow traffic

---

## Common Issues & Solutions

### Issue 1: "Connection Timeout"

**Causes:**
- Public access not enabled
- Security group not configured
- Wrong IP in security group
- Network/firewall blocking

**Solutions:**
1. ✅ Enable public access in RDS
2. ✅ Add security group rule for your IP
3. ✅ Wait 2-5 minutes after changes
4. ✅ Check your current IP address

### Issue 2: "Password Authentication Failed"

**Causes:**
- Wrong password
- Wrong username
- Password was auto-generated and not saved

**Solutions:**
1. ✅ Verify password in RDS console
2. ✅ Reset password if needed
3. ✅ Update `.env` file

### Issue 3: "Database Does Not Exist"

**Causes:**
- Database name mismatch
- Database not created

**Solutions:**
1. ✅ Verify database name in connection string
2. ✅ Create database if needed:
   ```sql
   CREATE DATABASE elevare;
   ```

### Issue 4: "SSL Required"

**Causes:**
- RDS requires SSL connection
- Connection string missing SSL parameter

**Solutions:**
1. ✅ Add `?sslmode=require` to connection string
2. ✅ Or use `?sslmode=prefer`

---

## Quick Checklist

Run through this checklist:

- [ ] RDS instance status is **"Available"**
- [ ] Public accessibility is **"Yes"**
- [ ] Security group has inbound rule for port 5432
- [ ] Security group source includes your current IP
- [ ] Connection string is correct in `.env`
- [ ] Username and password are correct
- [ ] Database name exists
- [ ] Network connectivity test passes
- [ ] Waited 2-5 minutes after making changes

---

## Still Not Working?

### Option 1: Use AWS Systems Manager Session Manager

Connect via EC2 instance in the same VPC (more secure, no public access needed).

### Option 2: Check AWS Support

1. Check CloudWatch logs for RDS
2. Review RDS events for errors
3. Contact AWS Support if needed

### Option 3: Verify from AWS Console

1. Use **RDS Query Editor** (if available in your region)
2. Or use **AWS CloudShell** to test connection

---

## Test Script

Run the included test script:

```bash
cd elevare
node test-db-connection.js
```

This will:
- ✅ Test basic connectivity
- ✅ Verify credentials
- ✅ Check if tables exist
- ✅ Provide specific error messages

---

## Next Steps After Connection Works

Once connected:

1. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

2. Verify tables created:
   ```bash
   npx prisma studio
   ```

3. Test application:
   ```bash
   npm run start:dev
   ```

