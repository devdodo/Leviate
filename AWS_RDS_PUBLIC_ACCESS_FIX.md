# Fix: RDS Database Not Publicly Accessible

## Quick Fix Steps

### Step 1: Enable Public Access on RDS Instance

1. **Go to AWS RDS Console**
   - Navigate to **RDS** → **Databases**
   - Click on your database instance (`elevare-staging-db`)

2. **Modify Public Access Setting**
   - Click **"Modify"** button (top right)
   - Scroll down to **"Connectivity"** section
   - Under **"Public access"**, select **"Publicly accessible"**
   - Click **"Continue"** at the bottom

3. **Apply Changes**
   - Choose **"Apply immediately"** (recommended) or schedule for maintenance window
   - Click **"Modify DB instance"**
   - Wait 2-5 minutes for changes to apply

### Step 2: Verify Security Group Configuration

1. **Go to EC2 Console**
   - Navigate to **EC2** → **Security Groups**
   - Find the security group associated with your RDS instance
     - You can find it in RDS → Your DB → **"Connectivity & security"** tab → **"VPC security groups"**

2. **Edit Inbound Rules**
   - Click on the security group
   - Go to **"Inbound rules"** tab
   - Click **"Edit inbound rules"**

3. **Add PostgreSQL Rule**
   - Click **"Add rule"**
   - **Type**: `PostgreSQL`
   - **Protocol**: `TCP`
   - **Port range**: `5432`
   - **Source**: 
     - For development: Select **"My IP"** (automatically adds your current IP)
     - OR manually enter your IP: `Your.IP.Address/32`
     - For production: Use your application server's security group ID
   - **Description**: `Allow PostgreSQL from my IP`
   - Click **"Save rules"**

### Step 3: Verify VPC Configuration

1. **Check Subnet Group**
   - In RDS → Your DB → **"Connectivity & security"** tab
   - Check **"Subnet group"**
   - Ensure it includes public subnets (if using custom VPC)

2. **Check Route Tables** (if using custom VPC)
   - Go to **VPC Console** → **Route Tables**
   - Find route table for your public subnets
   - Ensure it has an Internet Gateway route (`0.0.0.0/0` → `igw-xxxxx`)

### Step 4: Test Connection

After making changes, wait 2-5 minutes, then test:

```bash
# Test with Prisma
cd elevare
npx prisma db pull

# Or test with psql
psql -h elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com -U elevare_admin -d elevare
```

---

## Detailed Step-by-Step with Screenshots Guide

### Enable Public Access

1. **In RDS Console:**
   ```
   RDS → Databases → [Your DB Instance] → Modify
   ```

2. **In Modify Page:**
   - Scroll to **"Connectivity"** section
   - Find **"Public access"** dropdown
   - Change from **"Not publicly accessible"** to **"Publicly accessible"**
   - Click **"Continue"**

3. **Apply Changes:**
   - Select **"Apply immediately"**
   - Click **"Modify DB instance"**
   - Status will show **"Modifying"** for 2-5 minutes

### Configure Security Group

**Option A: Allow Your Current IP**

1. In EC2 → Security Groups → Your DB Security Group
2. Inbound rules → Edit inbound rules
3. Add rule:
   - Type: `PostgreSQL`
   - Source: `My IP` (button) or `Your.IP.Address/32`
4. Save rules

**Option B: Allow All IPs (NOT RECOMMENDED FOR PRODUCTION)**

⚠️ **Security Warning:** Only use for development/testing!

1. Add rule:
   - Type: `PostgreSQL`
   - Source: `0.0.0.0/0` (all IPs)
2. Save rules

**Option C: Allow Specific IP Range**

1. Add rule:
   - Type: `PostgreSQL`
   - Source: `Your.IP.Range/24` (e.g., `192.168.1.0/24`)
2. Save rules

---

## Troubleshooting

### Issue: Still Can't Connect After Enabling Public Access

**Check 1: Security Group**
- ✅ Verify security group has inbound rule for port 5432
- ✅ Verify source IP is correct
- ✅ Check if rule is active (not pending)

**Check 2: RDS Status**
- ✅ Database status should be **"Available"** (not "Modifying")
- ✅ Public accessibility should show **"Yes"** in Connectivity tab

**Check 3: Network ACLs** (if using custom VPC)
- Go to VPC → Network ACLs
- Ensure inbound/outbound rules allow traffic

**Check 4: Firewall/Network**
- Check your local firewall
- Check if your ISP blocks port 5432
- Try from different network

**Check 5: Connection String**
- Verify endpoint is correct
- Verify port is 5432
- Verify username and password
- Add `?sslmode=require` if SSL is required

### Issue: "Connection Timeout"

**Causes:**
1. Security group not configured
2. Public access not enabled
3. Wrong endpoint/port
4. Network/firewall blocking

**Solutions:**
1. Double-check security group rules
2. Verify public access is enabled
3. Test with `telnet` or `nc`:
   ```bash
   telnet elevare-staging-db.cfk6yyyiaa4a.eu-north-1.rds.amazonaws.com 5432
   ```

### Issue: "Password Authentication Failed"

**Causes:**
1. Wrong password
2. Wrong username
3. Password was auto-generated and not saved

**Solutions:**
1. Check password in RDS console (if auto-generated)
2. Reset password if needed:
   - RDS → Your DB → Modify
   - Change master password
   - Apply immediately

---

## Security Best Practices

### For Development
- ✅ Enable public access
- ✅ Restrict security group to your IP only
- ✅ Use SSL (`sslmode=require`)
- ✅ Strong password

### For Production
- ❌ **DO NOT** enable public access
- ✅ Use private subnets only
- ✅ Connect from within VPC (EC2, Lambda, etc.)
- ✅ Use security groups for access control
- ✅ Use VPN or AWS Direct Connect for external access
- ✅ Enable SSL/TLS encryption

---

## Quick Checklist

- [ ] Public access enabled in RDS instance
- [ ] Security group has inbound rule for port 5432
- [ ] Security group source is your IP (or specific range)
- [ ] Database status is "Available"
- [ ] Connection string includes SSL: `?sslmode=require`
- [ ] Tested connection successfully

---

## Alternative: Connect from EC2 Instance (More Secure)

If you don't want public access, you can:

1. **Launch EC2 instance** in the same VPC
2. **Connect to EC2** via SSH
3. **Connect to RDS** from EC2 (no public access needed)
4. **Use EC2 as jump host** for database access

This is more secure but requires EC2 instance running.

---

## Need Help?

If you're still having issues:

1. Check CloudWatch logs for RDS
2. Review security group rules
3. Verify VPC configuration
4. Test network connectivity
5. Check AWS RDS documentation

**Common Fix:** Most issues are resolved by:
1. Enabling public access ✅
2. Configuring security group ✅
3. Waiting 2-5 minutes for changes to apply ✅

