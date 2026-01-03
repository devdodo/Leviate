# Quick Fix: Caddy Service Failed to Start

## Immediate Steps

Run these commands on your EC2 server to diagnose and fix:

```bash
# 1. Check the exact error
sudo journalctl -xeu caddy.service | tail -30

# 2. Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

# 3. Check if Caddyfile exists and has correct domain
sudo cat /etc/caddy/Caddyfile | grep -E "^(backend\.|api\.)"
```

## Most Likely Issue: Wrong Domain in Caddyfile

The Caddyfile might still have `api.yourdomain.com` instead of `backend.leviateapp.com`.

### Fix:

```bash
# Update the Caddyfile on the server
sudo nano /etc/caddy/Caddyfile
```

**Change the first line from:**
```caddy
api.yourdomain.com {
```

**To:**
```caddy
backend.leviateapp.com {
```

**Also change:**
```caddy
www.api.yourdomain.com {
    redir https://api.yourdomain.com{uri} permanent
}
```

**To:**
```caddy
www.backend.leviateapp.com {
    redir https://backend.leviateapp.com{uri} permanent
}
```

**Save and exit (Ctrl+X, then Y, then Enter)**

## After Fixing Caddyfile

```bash
# 1. Validate again
sudo caddy validate --config /etc/caddy/Caddyfile

# 2. If validation passes, start Caddy
sudo systemctl start caddy

# 3. Check status
sudo systemctl status caddy

# 4. If still failing, check logs
sudo journalctl -u caddy -n 50
```

## Alternative: Copy Updated Caddyfile from Project

```bash
# Make sure you're in the project directory
cd /var/www/Leviate/elevare

# Copy the updated Caddyfile (I've updated it locally)
sudo cp Caddyfile /etc/caddy/Caddyfile

# Validate
sudo caddy validate --config /etc/caddy/Caddyfile

# Start
sudo systemctl start caddy

# Check
sudo systemctl status caddy
```

## Other Common Issues

### Issue: Port Already in Use

```bash
# Check what's using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true

# Then start Caddy
sudo systemctl start caddy
```

### Issue: Permission Problems

```bash
# Fix Caddyfile permissions
sudo chmod 644 /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile

# Fix Caddy data directory
sudo chown -R caddy:caddy /var/lib/caddy
```

## Complete Diagnostic Sequence

```bash
# Step 1: View error
sudo systemctl status caddy.service

# Step 2: View detailed logs
sudo journalctl -xeu caddy.service | tail -50

# Step 3: Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

# Step 4: Check domain in Caddyfile
sudo grep -E "^[a-z]" /etc/caddy/Caddyfile | head -1

# Step 5: If domain is wrong, fix it
sudo sed -i 's/api\.yourdomain\.com/backend.leviateapp.com/g' /etc/caddy/Caddyfile
sudo sed -i 's/www\.api\.yourdomain\.com/www.backend.leviateapp.com/g' /etc/caddy/Caddyfile

# Step 6: Validate again
sudo caddy validate --config /etc/caddy/Caddyfile

# Step 7: Start Caddy
sudo systemctl start caddy

# Step 8: Check status
sudo systemctl status caddy

# Step 9: Test
curl http://backend.leviateapp.com/api/health
```

