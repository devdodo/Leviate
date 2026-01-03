# Fix: Caddy Default Page and HTTPS Not Working

## Problem
- HTTP (http://backend.leviateapp.com/) shows Caddy default page
- HTTPS (https://backend.leviateapp.com/) cannot be reached

## Solution

### Step 1: Check Current Caddyfile

```bash
# View current Caddyfile
sudo cat /etc/caddy/Caddyfile
```

If it shows the default Caddyfile (with `:80`), you need to replace it.

### Step 2: Update Caddyfile

```bash
# Copy the correct Caddyfile from your project
sudo cp /var/www/Leviate/elevare/Caddyfile /etc/caddy/Caddyfile

# Edit and update domain name
sudo nano /etc/caddy/Caddyfile
```

**Replace the domain in the Caddyfile:**

Change:
```caddy
api.yourdomain.com {
```

To:
```caddy
backend.leviateapp.com {
```

### Step 3: Verify Application is Running

```bash
# Check if PM2 is running your app
pm2 status

# Test app directly
curl http://localhost:3000/api/health
# Should return JSON, not Caddy welcome page
```

### Step 4: Validate and Reload Caddy

```bash
# Validate configuration first
sudo caddy validate --config /etc/caddy/Caddyfile

# If validation passes, restart Caddy (reload may not work)
sudo systemctl restart caddy

# Alternative: Use Caddy's reload command
sudo caddy reload --config /etc/caddy/Caddyfile

# Check status
sudo systemctl status caddy

# If restart fails, check logs
sudo journalctl -u caddy -n 50
```

### Step 5: Check DNS

```bash
# Verify DNS points to your EC2 IP
dig backend.leviateapp.com
nslookup backend.leviateapp.com

# Should return your EC2 public IP or Elastic IP
```

### Step 6: Check Firewall

```bash
# Check if ports 80 and 443 are open
sudo ufw status

# If not open, allow them
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Step 7: Check Caddy Logs

```bash
# View Caddy logs for errors
sudo journalctl -u caddy -n 50

# Look for SSL certificate errors or DNS issues
```

## Complete Caddyfile for backend.leviateapp.com

If you need to create it from scratch:

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste this:

```

Then:
```bash
# Validate
sudo caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy (if reload doesn't work)
sudo systemctl restart caddy

# Or use Caddy's reload command
sudo caddy reload --config /etc/caddy/Caddyfile

# Check status
sudo systemctl status caddy
```

## Troubleshooting HTTPS Issues

### Issue 1: DNS Not Propagated

```bash
# Check DNS from multiple locations
dig backend.leviateapp.com @8.8.8.8
dig backend.leviateapp.com @1.1.1.1

# Wait for DNS propagation (can take up to 48 hours, usually 5-15 minutes)
```

### Issue 2: Port 443 Not Accessible

```bash
# Check if port 443 is listening
sudo netstat -tulpn | grep 443

# Check security group (AWS EC2)
# Ensure inbound rule allows HTTPS (443) from 0.0.0.0/0
```

### Issue 3: SSL Certificate Not Obtained

```bash
# Check certificate status
sudo caddy list-certificates

# Check Caddy logs for certificate errors
sudo journalctl -u caddy | grep -i certificate

# If using Let's Encrypt staging, switch to production
# Edit Caddyfile and ensure no "acme_ca" directive pointing to staging
```

### Issue 4: Caddy Can't Bind to Ports

```bash
# Check if another service is using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# If something is using them, stop it or configure Caddy differently
```

## Verify Everything Works

```bash
# 1. Test HTTP (should redirect to HTTPS or show your API)
curl -I http://backend.leviateapp.com/api/health

# 2. Test HTTPS
curl -I https://backend.leviateapp.com/api/health
# Should return 200 OK with SSL certificate

# 3. Test in browser
# Visit: https://backend.leviateapp.com/api/docs
# Should show Swagger UI (if enabled) or API response
```

## Quick Fix Commands

```bash
# Complete fix sequence
cd /var/www/Leviate/elevare

# 1. Update Caddyfile
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/api.yourdomain.com/backend.leviateapp.com/g' /etc/caddy/Caddyfile

# 2. Validate
sudo caddy validate --config /etc/caddy/Caddyfile

# 3. Restart Caddy (reload may not work)
sudo systemctl restart caddy

# Alternative: Use Caddy's reload
sudo caddy reload --config /etc/caddy/Caddyfile

# 4. Check
sudo systemctl status caddy
sudo journalctl -u caddy -n 20

# 5. Test
curl https://backend.leviateapp.com/api/health
```

