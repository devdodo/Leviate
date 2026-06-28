import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly gmailUser: string;

  constructor(
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {
    this.gmailUser = this.configService.get<string>('GMAIL_USER') || '';
  }

  async sendOTP(email: string, otp: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Leviate Account',
      html: this.getOTPEmailTemplate(otp, userName),
    });
  }

  async sendPasswordReset(email: string, defaultPassword: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Leviate Password Reset',
      html: this.getPasswordResetEmailTemplate(defaultPassword, userName),
    });
  }

  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Leviate!',
      html: this.getWelcomeEmailTemplate(userName),
    });
  }

  async sendWithdrawalOTP(email: string, otp: string, userName?: string, amount?: number): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Withdrawal OTP - Leviate',
      html: this.getWithdrawalOTPEmailTemplate(otp, userName, amount),
    });
  }

  private async sendEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.gmailUser) {
      this.logger.warn('GMAIL_USER not configured. Email not sent.');
      this.logger.debug(`Would send email to: ${payload.to} | Subject: ${payload.subject}`);
      return;
    }

    try {
      await this.mailerService.sendMail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      this.logger.log(`Email sent successfully to: ${payload.to}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
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
        <strong>Important:</strong> Please change your password immediately after logging in for security.
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
      <h1>Welcome to Leviate!</h1>
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

  private getWithdrawalOTPEmailTemplate(otp: string, userName?: string, amount?: number): string {
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
      <p>You requested to withdraw${amount ? ` <strong>&#8358;${amount}</strong>` : ' funds'} from your Leviate wallet. Please use the OTP code below to complete your withdrawal:</p>

      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>

      <div class="warning">
        <strong>Security Notice:</strong> This OTP will expire in <strong>10 minutes</strong>. Do not share this code with anyone.
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
