# Swagger Interface Troubleshooting

## Quick Fix

### Check 1: Access the Correct URL

Swagger should be available at:
```
http://localhost:3000/api/docs
```

Or if you set a custom path:
```
http://localhost:3000/[SWAGGER_PATH]
```

### Check 2: Verify Environment Variables

Make sure your `.env` file has:

```env
SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs
NODE_ENV=development
```

Or at minimum, don't set `SWAGGER_ENABLED=false`.

### Check 3: Check Console Output

When you start the server, you should see:
```
🚀 Application is running on: http://localhost:3000
📚 Swagger documentation: http://localhost:3000/api/docs
```

If you see `⚠️ Swagger is disabled`, then Swagger is not enabled.

---

## Common Issues

### Issue 1: Swagger Not Loading (404)

**Causes:**
- Swagger is disabled in environment
- Wrong URL path
- Server not running

**Solutions:**
1. Check `.env` file for `SWAGGER_ENABLED=true`
2. Verify URL: `http://localhost:3000/api/docs`
3. Check server is running on correct port

### Issue 2: Blank Page or Error

**Causes:**
- Helmet security headers blocking
- CORS issues
- JavaScript errors

**Solutions:**
1. Check browser console for errors
2. Try incognito/private window
3. Clear browser cache
4. Check if Helmet is configured correctly (should be fixed in code)

### Issue 3: "Swagger is disabled" Message

**Causes:**
- `SWAGGER_ENABLED=false` in `.env`
- `NODE_ENV=production` without `SWAGGER_ENABLED=true`

**Solutions:**
1. Set `SWAGGER_ENABLED=true` in `.env`
2. Or set `NODE_ENV=development`
3. Restart the server

---

## Manual Verification

### Test Swagger JSON Endpoint

Try accessing the JSON schema directly:
```
http://localhost:3000/api/docs-json
```

If this works, Swagger is configured correctly, and the issue is with the UI.

### Check Server Logs

Look for these messages on startup:
- ✅ `Swagger documentation: http://localhost:3000/api/docs` = Enabled
- ❌ `Swagger is disabled` = Disabled

---

## Force Enable Swagger

If you want Swagger always enabled (for development), you can modify `main.ts`:

```typescript
// Always enable Swagger (remove the if condition)
const config = new DocumentBuilder()...
SwaggerModule.setup('api/docs', app, document);
```

---

## Alternative: Check if Server Started

Make sure your server actually started:

1. Check terminal for errors
2. Verify port 3000 is not in use
3. Check if database connection is blocking startup

---

## Quick Test

1. **Start server:**
   ```bash
   npm run start:dev
   ```

2. **Check console output** for Swagger URL

3. **Open browser** to: `http://localhost:3000/api/docs`

4. **If still not working**, check:
   - Browser console (F12) for errors
   - Network tab for failed requests
   - Server logs for errors

---

## Default Configuration

By default, Swagger is enabled if:
- `SWAGGER_ENABLED` is not set to `false`, OR
- `NODE_ENV` is `development`, OR
- `SWAGGER_ENABLED` is set to `true`

This means Swagger should work out of the box in development mode.

