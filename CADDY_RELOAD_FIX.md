# Fix: Caddy Reload Not Working

## Problem
`sudo systemctl reload caddy` is not working or not available.

## Solution

### Option 1: Restart Caddy (Recommended)

```bash
# Stop and start Caddy
sudo systemctl restart caddy

# Check status
sudo systemctl status caddy
```

### Option 2: Use Caddy's Reload Command

```bash
# Use Caddy's built-in reload
sudo caddy reload --config /etc/caddy/Caddyfile

# Check if it worked
sudo systemctl status caddy
```

### Option 3: Stop and Start Manually

```bash
# Stop Caddy
sudo systemctl stop caddy

# Start Caddy
sudo systemctl start caddy

# Check status
sudo systemctl status caddy
```

## Check for Errors

If restart fails with "control process exited with error code":

```bash
# View detailed error logs
sudo journalctl -xeu caddy.service

# View recent Caddy logs
sudo journalctl -u caddy -n 50

# Check systemctl status for details
sudo systemctl status caddy.service
```

Common errors and fixes:

### Error: "Caddyfile syntax error"
```bash
# Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

# Fix any syntax errors shown
sudo nano /etc/caddy/Caddyfile
```

### Error: "Port already in use"
```bash
# Check what's using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# Kill the process if needed
sudo kill -9 <PID>
```

### Error: "Permission denied"
```bash
# Check Caddyfile permissions
ls -la /etc/caddy/Caddyfile

# Fix permissions
sudo chmod 644 /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile
```

## Common Issues

### Issue 1: Configuration Error

```bash
# Validate configuration first
sudo caddy validate --config /etc/caddy/Caddyfile

# If validation fails, fix the errors shown
# Then restart
sudo systemctl restart caddy
```

### Issue 2: Port Already in Use

```bash
# Check if ports 80/443 are in use
sudo lsof -i :80
sudo lsof -i :443

# If something is using them, stop it
sudo kill -9 <PID>
# Then restart Caddy
sudo systemctl restart caddy
```

### Issue 3: Permission Issues

```bash
# Check Caddyfile permissions
ls -la /etc/caddy/Caddyfile

# Should be readable by caddy user
# If not:
sudo chmod 644 /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile
```

## Complete Fix Sequence

```bash
# 1. Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# 2. If validation passes, restart
sudo systemctl restart caddy

# 3. Wait a few seconds, then check status
sleep 3
sudo systemctl status caddy

# 4. Check logs if there are issues
sudo journalctl -u caddy -n 30

# 5. Test
curl http://backend.leviateapp.com/api/health
```

## Verify Caddy is Running

```bash
# Check if Caddy process is running
ps aux | grep caddy

# Check if ports are listening
sudo netstat -tulpn | grep -E ':(80|443)'

# Should show caddy listening on ports 80 and 443
```

