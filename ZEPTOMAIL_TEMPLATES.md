# Zeptomail Email Templates for Leviate

This document contains all email templates that need to be created in your Zeptomail account. Each template uses Zeptomail's template variable system.

## How to Use These Templates

1. Log in to your Zeptomail dashboard
2. Navigate to **Email Templates** section
3. Create a new template for each template below
4. Copy the HTML content and paste it into Zeptomail's template editor
5. Configure the template variables as specified
6. Note the Template ID for each template
7. Add the Template IDs to your `.env` file (see `env.example`)

## Template Variables

Zeptomail uses `{{variable_name}}` syntax for template variables. Make sure to configure these in your Zeptomail template settings.

---

## 1. Email Verification OTP

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_OTP_VERIFICATION`

**Subject:** Verify Your Leviate Account

**Variables:**
- `{{userName}}` - User's name (optional, defaults to "there")
- `{{otp}}` - 6-digit OTP code
- `{{expiresIn}}` - Expiration time (e.g., "15 minutes")

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Leviate!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Thank you for registering with Leviate. Please verify your email address using the OTP code below:</p>
      
      <div class="otp-box">
        <div class="otp-code">{{otp}}</div>
      </div>
      
      <p>This code will expire in <strong>{{expiresIn}}</strong>.</p>
      <p>If you didn't create an account with Leviate, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Password Reset

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_PASSWORD_RESET`

**Subject:** Your Leviate Password Reset

**Variables:**
- `{{userName}}` - User's name (optional)
- `{{temporaryPassword}}` - Temporary password

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .password-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .password { font-size: 18px; font-weight: bold; color: #667eea; font-family: monospace; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your password has been reset. Please use the temporary password below to log in:</p>
      
      <div class="password-box">
        <div class="password">{{temporaryPassword}}</div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> Please change your password immediately after logging in for security.
      </div>
      
      <p>If you didn't request this password reset, please contact support immediately.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Welcome Email

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_WELCOME`

**Subject:** Welcome to Leviate! 🎉

**Variables:**
- `{{userName}}` - User's name (optional)
- `{{reputationScore}}` - Initial reputation score (default: 75)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Leviate! 🎉</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your email has been verified successfully! Your account is now active.</p>
      <p>You can now start using Leviate to connect creators with contributors.</p>
      <p>Your initial reputation score is <strong>{{reputationScore}}</strong>. Complete tasks successfully to increase your reputation!</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Withdrawal OTP

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_WITHDRAWAL_OTP`

**Subject:** Withdrawal OTP - Leviate

**Variables:**
- `{{userName}}` - User's name (optional)
- `{{otp}}` - 6-digit OTP code
- `{{expiresIn}}` - Expiration time (e.g., "10 minutes")
- `{{amount}}` - Withdrawal amount (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Withdrawal OTP Verification</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>You requested to withdraw funds from your Leviate wallet. Please use the OTP code below to complete your withdrawal:</p>
      
      <div class="otp-box">
        <div class="otp-code">{{otp}}</div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This OTP will expire in <strong>{{expiresIn}}</strong>. Do not share this code with anyone.
      </div>
      
      <p>If you didn't request this withdrawal, please contact support immediately.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Task Created

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_TASK_CREATED`

**Subject:** New Task Available: {{taskTitle}}

**Variables:**
- `{{userName}}` - Tasker's name
- `{{taskTitle}}` - Task title
- `{{taskId}}` - Task ID
- `{{budget}}` - Task budget
- `{{platform}}` - Platform name

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .task-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Task Available!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>A new task has been created that matches your profile:</p>
      
      <div class="task-box">
        <h2>{{taskTitle}}</h2>
        <p><strong>Platform:</strong> {{platform}}</p>
        <p><strong>Budget:</strong> ₦{{budget}}</p>
      </div>
      
      <p>Apply now to get started!</p>
      <a href="{{appUrl}}/tasks/{{taskId}}" class="button">View Task</a>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 6. Task Applied

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_TASK_APPLIED`

**Subject:** Application Received for: {{taskTitle}}

**Variables:**
- `{{userName}}` - Creator's name
- `{{taskTitle}}` - Task title
- `{{taskerName}}` - Tasker's name
- `{{taskId}}` - Task ID

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Application Received</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p><strong>{{taskerName}}</strong> has applied for your task: <strong>{{taskTitle}}</strong></p>
      <p>Review the application and approve or decline it.</p>
      <a href="{{appUrl}}/tasks/{{taskId}}/applications" class="button">Review Application</a>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 7. Task Approved

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_TASK_APPROVED`

**Subject:** Your Application Was Approved: {{taskTitle}}

**Variables:**
- `{{userName}}` - Tasker's name
- `{{taskTitle}}` - Task title
- `{{taskId}}` - Task ID
- `{{budget}}` - Task budget

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Application Approved!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Great news! Your application for <strong>{{taskTitle}}</strong> has been approved!</p>
      <p>You can now start working on the task. Complete it successfully to earn ₦{{budget}}.</p>
      <a href="{{appUrl}}/tasks/{{taskId}}" class="button">View Task</a>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 8. Task Declined

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_TASK_DECLINED`

**Subject:** Application Update: {{taskTitle}}

**Variables:**
- `{{userName}}` - Tasker's name
- `{{taskTitle}}` - Task title
- `{{reason}}` - Decline reason (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Application Update</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Unfortunately, your application for <strong>{{taskTitle}}</strong> was not selected at this time.</p>
      {{#if reason}}
      <p><strong>Reason:</strong> {{reason}}</p>
      {{/if}}
      <p>Don't worry! Keep applying to other tasks that match your skills.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 9. Submission Verified

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_SUBMISSION_VERIFIED`

**Subject:** ✅ Task Submission Verified: {{taskTitle}}

**Variables:**
- `{{userName}}` - Tasker's name
- `{{taskTitle}}` - Task title
- `{{payoutAmount}}` - Payout amount
- `{{verificationScore}}` - AI verification score (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .payout-box { background: white; border: 2px solid #28a745; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Submission Verified!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Congratulations! Your submission for <strong>{{taskTitle}}</strong> has been verified and approved.</p>
      
      <div class="payout-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Your payout:</p>
        <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #28a745;">₦{{payoutAmount}}</p>
      </div>
      
      <p>The funds have been credited to your wallet. You can now withdraw them to your bank account.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 10. Submission Rejected

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_SUBMISSION_REJECTED`

**Subject:** Submission Rejected: {{taskTitle}}

**Variables:**
- `{{userName}}` - Tasker's name
- `{{taskTitle}}` - Task title
- `{{reason}}` - Rejection reason (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Submission Rejected</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your submission for <strong>{{taskTitle}}</strong> was rejected.</p>
      {{#if reason}}
      <p><strong>Reason:</strong> {{reason}}</p>
      {{/if}}
      <p>Please review the task requirements and submit again if needed.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 11. Payout Received

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_PAYOUT_RECEIVED`

**Subject:** 💰 Payout Received: ₦{{amount}}

**Variables:**
- `{{userName}}` - User's name
- `{{amount}}` - Payout amount
- `{{source}}` - Source (e.g., "Task completion", "Referral reward")
- `{{balance}}` - Current wallet balance

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .payout-box { background: white; border: 2px solid #28a745; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Payout Received!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>You've received a payout:</p>
      
      <div class="payout-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Amount:</p>
        <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #28a745;">₦{{amount}}</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Source: {{source}}</p>
      </div>
      
      <p>Your current wallet balance is <strong>₦{{balance}}</strong>.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 12. Withdrawal Processed

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_WITHDRAWAL_PROCESSED`

**Subject:** ✅ Withdrawal Processed: ₦{{amount}}

**Variables:**
- `{{userName}}` - User's name
- `{{amount}}` - Withdrawal amount
- `{{bankAccount}}` - Bank account details
- `{{transactionId}}` - Transaction ID

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Withdrawal Processed</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your withdrawal has been processed successfully!</p>
      
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Amount:</strong> ₦{{amount}}</p>
        <p style="margin: 5px 0;"><strong>Bank Account:</strong> {{bankAccount}}</p>
        <p style="margin: 5px 0;"><strong>Transaction ID:</strong> {{transactionId}}</p>
      </div>
      
      <p>The funds should appear in your bank account within 1-3 business days.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 13. Withdrawal Failed

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_WITHDRAWAL_FAILED`

**Subject:** ⚠️ Withdrawal Failed: ₦{{amount}}

**Variables:**
- `{{userName}}` - User's name
- `{{amount}}` - Withdrawal amount
- `{{reason}}` - Failure reason
- `{{transactionId}}` - Transaction ID

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Withdrawal Failed</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Unfortunately, your withdrawal of ₦{{amount}} could not be processed.</p>
      
      <div class="warning-box">
        <p style="margin: 5px 0;"><strong>Reason:</strong> {{reason}}</p>
        <p style="margin: 5px 0;"><strong>Transaction ID:</strong> {{transactionId}}</p>
      </div>
      
      <p>The funds have been returned to your wallet. Please verify your bank account details and try again, or contact support if the issue persists.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 14. Referral Reward

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_REFERRAL_REWARD`

**Subject:** 🎁 Referral Reward: ₦{{amount}}

**Variables:**
- `{{userName}}` - Referrer's name
- `{{amount}}` - Reward amount
- `{{referredUser}}` - Referred user's email/name
- `{{totalEarnings}}` - Total referral earnings (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .reward-box { background: white; border: 2px solid #ff6b6b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎁 Referral Reward!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Congratulations! You've earned a referral reward:</p>
      
      <div class="reward-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Reward for referring:</p>
        <p style="margin: 5px 0; font-size: 16px; color: #333;">{{referredUser}}</p>
        <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #ff6b6b;">₦{{amount}}</p>
      </div>
      
      {{#if totalEarnings}}
      <p>Your total referral earnings: <strong>₦{{totalEarnings}}</strong></p>
      {{/if}}
      
      <p>Keep referring friends to earn more rewards!</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 15. Profile Incomplete

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_PROFILE_INCOMPLETE`

**Subject:** Complete Your Profile to Get More Tasks

**Variables:**
- `{{userName}}` - User's name
- `{{missingFields}}` - List of missing fields (optional)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; background: #ffc107; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Your Profile</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your profile is incomplete. Complete it to get matched with more tasks and increase your chances of approval!</p>
      
      {{#if missingFields}}
      <p><strong>Missing information:</strong></p>
      <ul>
        {{#each missingFields}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
      {{/if}}
      
      <a href="{{appUrl}}/profile/edit" class="button">Complete Profile</a>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 16. NIN Verification Required

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_NIN_VERIFICATION_REQUIRED`

**Subject:** NIN Verification Required for Withdrawals

**Variables:**
- `{{userName}}` - User's name

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NIN Verification Required</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>To withdraw funds from your wallet, you need to verify your National Identification Number (NIN).</p>
      
      <div class="warning-box">
        <strong>⚠️ Important:</strong> NIN verification is required for security and compliance purposes. You cannot withdraw funds until your NIN is verified.
      </div>
      
      <a href="{{appUrl}}/profile/verify-nin" class="button">Verify NIN</a>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 17. System Alert

**Template ID Variable:** `ZEPTOMAIL_TEMPLATE_SYSTEM_ALERT`

**Subject:** {{alertTitle}}

**Variables:**
- `{{userName}}` - User's name
- `{{alertTitle}}` - Alert title
- `{{alertMessage}}` - Alert message
- `{{alertType}}` - Alert type (info, warning, error, success)

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{alertTitle}}</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>{{alertMessage}}</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## Notes

1. **Template Variables**: Zeptomail uses different syntax depending on the template engine. The examples above use Handlebars-style syntax (`{{variable}}`). Adjust based on your Zeptomail configuration.

2. **Conditional Rendering**: Some templates include conditional blocks (e.g., `{{#if reason}}`). Zeptomail may support different syntax - check your Zeptomail documentation.

3. **Styling**: All templates use inline CSS for maximum email client compatibility.

4. **Images**: If you want to add logos or images, upload them to Zeptomail's media library and reference them using absolute URLs.

5. **Testing**: Test each template in Zeptomail's preview mode before going live.

6. **Fallback**: If a template ID is not set in `.env`, the email service will fall back to inline HTML templates.

---

## Next Steps

1. Create all templates in your Zeptomail dashboard
2. Copy the Template IDs from Zeptomail
3. Add them to your `.env` file (see `env.example` for variable names)
4. Restart your application

