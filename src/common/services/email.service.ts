import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly zeptomailToken: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly bounceAddress: string;
  private readonly templateIds: Map<string, string>;

  constructor(private configService: ConfigService) {
    this.zeptomailToken = this.configService.get<string>('ZEPTOMAIL_TOKEN') || '';
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@leviateapp.com';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'Leviate';
    // Bounce address must be verified in Zeptomail dashboard
    // If not set or invalid, Zeptomail will use the default bounce address
    this.bounceAddress =
      this.configService.get<string>('ZEPTOMAIL_BOUNCE_ADDRESS') || '';

    // Load template IDs from environment
    this.templateIds = new Map();
    const templateKeys = [
      'ZEPTOMAIL_TEMPLATE_OTP_VERIFICATION',
      'ZEPTOMAIL_TEMPLATE_PASSWORD_RESET',
      'ZEPTOMAIL_TEMPLATE_WELCOME',
      'ZEPTOMAIL_TEMPLATE_WITHDRAWAL_OTP',
      'ZEPTOMAIL_TEMPLATE_TASK_CREATED',
      'ZEPTOMAIL_TEMPLATE_TASK_APPLIED',
      'ZEPTOMAIL_TEMPLATE_TASK_APPROVED',
      'ZEPTOMAIL_TEMPLATE_TASK_DECLINED',
      'ZEPTOMAIL_TEMPLATE_SUBMISSION_VERIFIED',
      'ZEPTOMAIL_TEMPLATE_SUBMISSION_REJECTED',
      'ZEPTOMAIL_TEMPLATE_PAYOUT_RECEIVED',
      'ZEPTOMAIL_TEMPLATE_WITHDRAWAL_PROCESSED',
      'ZEPTOMAIL_TEMPLATE_WITHDRAWAL_FAILED',
      'ZEPTOMAIL_TEMPLATE_REFERRAL_REWARD',
      'ZEPTOMAIL_TEMPLATE_PROFILE_INCOMPLETE',
      'ZEPTOMAIL_TEMPLATE_NIN_VERIFICATION_REQUIRED',
      'ZEPTOMAIL_TEMPLATE_SYSTEM_ALERT',
    ];

    templateKeys.forEach((key) => {
      const templateId = this.configService.get<string>(key);
      if (templateId) {
        this.templateIds.set(key, templateId);
      }
    });
  }

  async sendOTP(email: string, otp: string, userName?: string): Promise<void> {
    const subject = 'Verify Your Leviate Account';
    const templateId = this.templateIds.get('ZEPTOMAIL_TEMPLATE_OTP_VERIFICATION');
    const htmlContent = this.getOTPEmailTemplate(otp, userName);

    await this.sendEmail({
      to: [{ email_address: { address: email } }],
      subject,
      htmlbody: htmlContent,
      templateId,
      templateData: {
        userName: userName || 'there',
        otp,
        expiresIn: '15 minutes',
      },
    });
  }

  async sendPasswordReset(email: string, defaultPassword: string, userName?: string): Promise<void> {
    const subject = 'Your Leviate Password Reset';
    const templateId = this.templateIds.get('ZEPTOMAIL_TEMPLATE_PASSWORD_RESET');
    const htmlContent = this.getPasswordResetEmailTemplate(defaultPassword, userName);

    await this.sendEmail({
      to: [{ email_address: { address: email } }],
      subject,
      htmlbody: htmlContent,
      templateId,
      templateData: {
        userName: userName || 'there',
        temporaryPassword: defaultPassword,
      },
    });
  }

  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    const subject = 'Welcome to Leviate!';
    const templateId = this.templateIds.get('ZEPTOMAIL_TEMPLATE_WELCOME');
    const htmlContent = this.getWelcomeEmailTemplate(userName);

    await this.sendEmail({
      to: [{ email_address: { address: email } }],
      subject,
      htmlbody: htmlContent,
      templateId,
      templateData: {
        userName: userName || 'there',
        reputationScore: '75',
      },
    });
  }

  async sendWithdrawalOTP(email: string, otp: string, userName?: string, amount?: number): Promise<void> {
    const subject = 'Withdrawal OTP - Leviate';
    const templateId = this.templateIds.get('ZEPTOMAIL_TEMPLATE_WITHDRAWAL_OTP');
    const htmlContent = this.getWithdrawalOTPEmailTemplate(otp, userName);

    await this.sendEmail({
      to: [{ email_address: { address: email } }],
      subject,
      htmlbody: htmlContent,
      templateId,
      templateData: {
        userName: userName || 'there',
        otp,
        expiresIn: '10 minutes',
        amount: amount ? `₦${amount}` : undefined,
      },
    });
  }

  private async sendEmail(payload: {
    to: Array<{ email_address: { address: string } }>;
    subject: string;
    htmlbody: string;
    templateId?: string;
    templateData?: Record<string, any>;
  }): Promise<void> {
    if (!this.zeptomailToken) {
      this.logger.warn('ZEPTOMAIL_TOKEN not configured. Email not sent.');
      this.logger.debug(`Would send email to: ${payload.to[0].email_address.address}`);
      this.logger.debug(`Subject: ${payload.subject}`);
      return;
    }

    try {
      let zeptomailUrl: string;
      let emailPayload: any;

      // Use template-based email if template ID is provided
      if (payload.templateId) {
        zeptomailUrl = 'https://api.zeptomail.com/v1.1/email/template';
        emailPayload = {
          from: {
            address: this.fromEmail,
            name: this.fromName,
          },
          to: payload.to,
          template_key: payload.templateId,
          merge_info: payload.templateData || {},
        };
        // Only include bounce_address if it's set and verified in Zeptomail
        if (this.bounceAddress) {
          emailPayload.bounce_address = this.bounceAddress;
        }
        this.logger.debug(`Using Zeptomail template: ${payload.templateId}`);
      } else {
        // Fallback to inline HTML email
        zeptomailUrl = 'https://api.zeptomail.com/v1.1/email';
        emailPayload = {
          from: {
            address: this.fromEmail,
            name: this.fromName,
          },
          to: payload.to,
          subject: payload.subject,
          htmlbody: payload.htmlbody,
        };
        // Only include bounce_address if it's set and verified in Zeptomail
        if (this.bounceAddress) {
          emailPayload.bounce_address = this.bounceAddress;
        }
        this.logger.debug('Using inline HTML email (no template ID provided)');
      }

      const response = await fetch(zeptomailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Zoho-enczapikey ${this.zeptomailToken}`,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zeptomail API error: ${response.status} - ${errorText}`);
      }

      this.logger.log(`Email sent successfully to: ${payload.to[0].email_address.address}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      // Don't throw - allow app to continue even if email fails
    }
  }

  private getOTPEmailTemplate(otp: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
      <p>Hi ${userName || 'there'},</p>
      <p>Thank you for registering with Leviate. Please verify your email address using the OTP code below:</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <p>This code will expire in <strong>15 minutes</strong>.</p>
      <p>If you didn't create an account with Leviate, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getPasswordResetEmailTemplate(password: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
      <p>Hi ${userName || 'there'},</p>
      <p>Your password has been reset. Please use the temporary password below to log in:</p>
      
      <div class="password-box">
        <div class="password">${password}</div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> Please change your password immediately after logging in for security.
      </div>
      
      <p>If you didn't request this password reset, please contact support immediately.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getWelcomeEmailTemplate(userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
      <p>Hi ${userName || 'there'},</p>
      <p>Your email has been verified successfully! Your account is now active.</p>
      <p>You can now start using Leviate to connect creators with contributors.</p>
      <p>Your initial reputation score is <strong>75</strong>. Complete tasks successfully to increase your reputation!</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getWithdrawalOTPEmailTemplate(otp: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
      <p>Hi ${userName || 'there'},</p>
      <p>You requested to withdraw funds from your Leviate wallet. Please use the OTP code below to complete your withdrawal:</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This OTP will expire in <strong>10 minutes</strong>. Do not share this code with anyone.
      </div>
      
      <p>If you didn't request this withdrawal, please contact support immediately.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Leviate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

