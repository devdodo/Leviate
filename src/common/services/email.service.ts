import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as templates from '../emails/email-templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly smtpUser: string;

  constructor(
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
  }

  /* -------------------------------------------------------------- */
  /* Account & auth                                                 */
  /* -------------------------------------------------------------- */

  async sendOTP(email: string, otp: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Leviate Account',
      html: templates.emailVerificationOtp(otp, userName),
    });
  }

  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Leviate!',
      html: templates.welcome(userName),
    });
  }

  async sendPasswordReset(email: string, defaultPassword: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Leviate Password Reset',
      html: templates.passwordReset(defaultPassword, userName),
    });
  }

  async sendPasswordChanged(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Leviate Password Was Changed',
      html: templates.passwordChanged(userName),
    });
  }

  async sendAccountSuspended(email: string, reason?: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Leviate Account Has Been Suspended',
      html: templates.accountSuspended(reason, userName),
    });
  }

  async sendAccountReactivated(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Leviate Account Has Been Reactivated',
      html: templates.accountReactivated(userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Wallet & payments                                              */
  /* -------------------------------------------------------------- */

  async sendWithdrawalOTP(email: string, otp: string, userName?: string, amount?: number): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Withdrawal OTP - Leviate',
      html: templates.withdrawalOtp(otp, userName, amount),
    });
  }

  async sendWithdrawalProcessed(
    email: string,
    details: { amount: number; bankName?: string; accountLast4?: string; reference?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Withdrawal Successful - Leviate',
      html: templates.withdrawalProcessed(details, userName),
    });
  }

  async sendWithdrawalFailed(
    email: string,
    details: { amount: number; reason?: string; reference?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Withdrawal Failed - Leviate',
      html: templates.withdrawalFailed(details, userName),
    });
  }

  async sendPayoutReceived(
    email: string,
    details: { amount: number; campaignTitle?: string; newBalance?: number },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: "You've Been Paid - Leviate",
      html: templates.payoutReceived(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Campaigns / tasks — creator side                               */
  /* -------------------------------------------------------------- */

  async sendNewApplicationReceived(
    email: string,
    details: { campaignTitle: string; applicantName?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'New Application Received - Leviate',
      html: templates.newApplicationReceived(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Campaigns / tasks — contributor side                           */
  /* -------------------------------------------------------------- */

  async sendApplicationApproved(
    email: string,
    details: { campaignTitle: string; payout?: number },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Application Was Approved - Leviate',
      html: templates.applicationApproved(details, userName),
    });
  }

  async sendApplicationDeclined(
    email: string,
    details: { campaignTitle: string; reason?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Update on Your Application - Leviate',
      html: templates.applicationDeclined(details, userName),
    });
  }

  async sendSubmissionVerified(
    email: string,
    details: { campaignTitle: string; payout?: number },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Submission Was Approved - Leviate',
      html: templates.submissionVerified(details, userName),
    });
  }

  async sendSubmissionRejected(
    email: string,
    details: { campaignTitle: string; reason?: string; canResubmit?: boolean },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Submission Needs Attention - Leviate',
      html: templates.submissionRejected(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Referrals                                                      */
  /* -------------------------------------------------------------- */

  async sendReferralReward(
    email: string,
    details: { amount: number; referredName?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: "You've Earned a Referral Reward - Leviate",
      html: templates.referralReward(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Verification & profile                                         */
  /* -------------------------------------------------------------- */

  async sendNinVerificationRequired(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Identity - Leviate',
      html: templates.ninVerificationRequired(userName),
    });
  }

  async sendProfileIncomplete(email: string, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Complete Your Profile - Leviate',
      html: templates.profileIncomplete(userName),
    });
  }

  async sendSocialVerified(email: string, details: { platform?: string }, userName?: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Social Account Verified - Leviate',
      html: templates.socialVerified(details, userName),
    });
  }

  async sendSocialRejected(
    email: string,
    details: { platform?: string; reason?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Social Verification Update - Leviate',
      html: templates.socialRejected(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Disputes                                                       */
  /* -------------------------------------------------------------- */

  async sendDisputeOpened(
    email: string,
    details: { disputeId: string; campaignTitle?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'We Received Your Dispute - Leviate',
      html: templates.disputeOpened(details, userName),
    });
  }

  async sendDisputeResolved(
    email: string,
    details: { disputeId: string; outcome?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Dispute Has Been Resolved - Leviate',
      html: templates.disputeResolved(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Admin & system                                                 */
  /* -------------------------------------------------------------- */

  async sendCampaignTerminationAdminAlert(
    email: string,
    details: {
      campaignTitle: string;
      netRefundAmount: number;
      terminationFeeAmount: number;
      terminationRequestId: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Action Required: Campaign Cancellation Refund - Leviate',
      html: templates.campaignTerminationAdminAlert(details),
    });
  }

  async sendSystemAlert(
    email: string,
    details: { heading: string; message: string; ctaText?: string; ctaUrl?: string },
    userName?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `${details.heading} - Leviate`,
      html: templates.systemAlert(details, userName),
    });
  }

  /* -------------------------------------------------------------- */
  /* Delivery                                                       */
  /* -------------------------------------------------------------- */

  private async sendEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.smtpUser) {
      this.logger.warn('SMTP_USER not configured. Email not sent.');
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
}
