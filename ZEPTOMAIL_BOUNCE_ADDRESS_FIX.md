# Fix: Zeptomail Bounce Address Error

## Error
```
SM_113 - Invalid email address for bounce_address
Target value: "noreply@leviateapp.com"
```

## Problem
Zeptomail requires bounce addresses to be **verified** in their dashboard before they can be used. The bounce address `noreply@leviateapp.com` is not verified.

## Solution

### Option 1: Verify the Bounce Address (Recommended)

1. **Log in to Zeptomail Dashboard**
   - Go to: https://www.zeptomail.com/
   - Navigate to: **Settings** → **Bounce Address**

2. **Add and Verify Bounce Address**
   - Click "Add Bounce Address"
   - Enter: `noreply@leviateapp.com`
   - Verify the email address (check your inbox for verification email)
   - Once verified, it will be available for use

3. **Update Your .env File**
   ```env
   ZEPTOMAIL_BOUNCE_ADDRESS=noreply@leviateapp.com
   ```

### Option 2: Use Zeptomail Default (Quick Fix)

If you don't want to verify a bounce address right now:

1. **Leave bounce address empty in .env**
   ```env
   ZEPTOMAIL_BOUNCE_ADDRESS=
   ```

2. **Zeptomail will use their default bounce address**
   - This works immediately without verification
   - You can verify your own bounce address later

## What is a Bounce Address?

A bounce address is the email address where bounced (undeliverable) emails are sent. It's used for:
- Handling delivery failures
- Tracking email deliverability
- Managing email reputation

## Current Fix Applied

The code has been updated to:
- Make bounce address optional
- Only include it in the API request if it's set
- Use Zeptomail's default bounce address if not specified

## Next Steps

1. **If using Option 2 (empty bounce address):**
   - Restart your server
   - Emails should work now

2. **If using Option 1 (verify bounce address):**
   - Verify the address in Zeptomail dashboard
   - Update your `.env` file with the verified address
   - Restart your server

## Verification

After applying the fix, try sending an email again. The error should be resolved.

