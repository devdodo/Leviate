# Quick Fix: Permission Denied Error

## Error
```
EACCES: permission denied, mkdir '/var/www/Leviate/node_modules'
```

## Immediate Fix

Run these commands on your EC2 server:

```bash
# Fix ownership of the project directory
sudo chown -R ubuntu:ubuntu /var/www/Leviate

# Navigate to the project
cd /var/www/Leviate/elevare

# Now install dependencies
npm install --production --legacy-peer-deps
```

## Explanation

The directory was created with `sudo`, so it's owned by `root`. The `ubuntu` user needs ownership to run `npm install` which creates the `node_modules` directory.

## Verify Fix

```bash
# Check ownership
ls -la /var/www/Leviate

# Should show:
# drwxr-xr-x ubuntu ubuntu ...
```

## For Future Deployments

Always fix ownership after cloning:

```bash
sudo git clone https://github.com/your-username/repo.git
sudo chown -R ubuntu:ubuntu /var/www/repo
cd /var/www/repo
npm install --production --legacy-peer-deps
```

