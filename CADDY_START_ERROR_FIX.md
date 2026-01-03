# Fix: Caddy Service Failed to Start

## Error
```
Job for caddy.service failed because the control process exited with error code.
```

## Immediate Diagnosis

Run these commands to see the exact error:

```bash
# 1. Check detailed error
sudo systemctl status caddy.service

# 2. View error logs
sudo journalctl -xeu caddy.service

# 3. View recent Caddy logs
sudo journalctl -u caddy -n 50
```

## Common Fixes

### Fix 1: Validate Caddyfile

```bash
# Validate Caddyfile syntax
sudo caddy validate --config /etc/caddy/Caddyfile

# If errors are shown, fix them
sudo nano /etc/caddy/Caddyfile
```

### Fix 2: Check Port Conflicts

```bash
# Check if ports 80/443 are already in use
sudo lsof -i :80
sudo lsof -i :443

# If something is using them, stop it
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true

# Then restart Caddy
sudo systemctl restart caddy
```

### Fix 3: Check Permissions

```bash
# Check Caddyfile permissions
ls -la /etc/caddy/Caddyfile

# Should be readable by caddy user
# Fix if needed:
sudo chmod 644 /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile

# Check Caddy directories
ls -la /var/lib/caddy
sudo chown -R caddy:caddy /var/lib/caddy
```

### Fix 4: Check Caddyfile Location

```bash
# Verify Caddyfile exists
ls -la /etc/caddy/Caddyfile

# Check if Caddy is looking in the right place
sudo caddy file-server --listen :2015 --root /var/www/html
# This tests if Caddy can run at all
```

### Fix 5: Reinstall Caddy (Last Resort)

```bash
# Stop Caddy
sudo systemctl stop caddy

# Remove and reinstall
sudo apt remove --purge caddy
sudo apt install caddy

# Copy your Caddyfile
sudo cp /var/www/Leviate/elevare/Caddyfile /etc/caddy/Caddyfile

# Update domain
sudo sed -i 's/api.yourdomain.com/backend.leviateapp.com/g' /etc/caddy/Caddyfile

# Validate
sudo caddy validate --config /etc/caddy/Caddyfile

# Start
sudo systemctl start caddy
sudo systemctl enable caddy
```

## Step-by-Step Fix

```bash
# 1. Check the exact error
sudo journalctl -xeu caddy.service | tail -30

# 2. Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

# 3. If validation fails, check the error message
# Common issues:
#   - Missing closing brace }
#   - Invalid domain name
#   - Syntax error

# 4. Fix the Caddyfile
sudo nano /etc/caddy/Caddyfile

# 5. Validate again
sudo caddy validate --config /etc/caddy/Caddyfile

# 6. Try starting again
sudo systemctl start caddy

# 7. Check status
sudo systemctl status caddy
```

## Minimal Working Caddyfile

If you need a minimal Caddyfile to test:

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste this minimal config:

```caddy
backend.leviateapp.com {
    reverse_proxy localhost:3000
}
```

Then:
```bash
# Validate
sudo caddy validate --config /etc/caddy/Caddyfile

# Start
sudo systemctl start caddy

# Check
sudo systemctl status caddy
```

## Verify Caddy is Running

```bash
# Check process
ps aux | grep caddy

# Check ports
sudo netstat -tulpn | grep -E ':(80|443)'

# Test
curl http://backend.leviateapp.com/api/health
```

