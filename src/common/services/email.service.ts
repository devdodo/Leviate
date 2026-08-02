import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as templates from '../emails/email-templates';

/** Resend's shared sandbox sender, usable before a domain is verified. */
const RESEND_SANDBOX_FROM = 'onboarding@resend.dev';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.resend = apiKey ? new Resend(apiKey) : null;

    const fromName = this.configService.get<string>('FROM_NAME') || 'Leviate';
    const fromEmail =
      this.configService.get<string>('FROM_EMAIL') || RESEND_SANDBOX_FROM;
    this.from = `${fromName} <${fromEmail}>`;
    this.replyTo = this.configService.get<string>('REPLY_TO_EMAIL') || undefined;

    // Explicit off-switch for local/CI runs; defaults to on when unset.
    this.enabled =
      (this.configService.get<string>('NOTIFICATION_EMAIL_ENABLED') || 'true')
        .trim()
        .toLowerCase() !== 'false';
  }

  /**
   * Report the effective configuration at boot, and confirm the API key works,
   * so a bad key or an unverified sending domain is visible in the startup log
   * rather than only when the first email is attempted.
   *
   * Deliberately not awaited: a broken email path must not delay app startup.
   */
  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn(
        'NOTIFICATION_EMAIL_ENABLED=false — email sending is disabled.',
      );
      return;
    }
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured. Email not sent.');
      return;
    }

    this.logger.log(`Email provider: Resend | from: ${this.from}`);
    void this.verifyConfiguration();
  }

  /**
   * Lists the account's domains to prove the key is valid and to surface the
   * verification status of the sending domain. A send-only key cannot read
   * domains, which is not an error — it just can't be checked this way.
   */
  private async verifyConfiguration(): Promise<void> {
    if (!this.resend) return;

    try {
      const { data, error } = await this.resend.domains.list();

      if (error) {
        this.logger.warn(
          `Could not verify Resend configuration: ${error.message}. ` +
            `This is expected for a send-only API key; a 401/invalid_api_key means the key is wrong.`,
        );
        return;
      }

      const domains = data?.data ?? [];
      const sendingDomain = this.from.split('@').pop()?.replace('>', '').trim();
      const match = domains.find((d) => d.name === sendingDomain);

      if (sendingDomain === 'resend.dev') {
        this.logger.warn(
          `Sending from Resend's sandbox address (${RESEND_SANDBOX_FROM}). ` +
            `It only delivers to your own Resend account address — set FROM_EMAIL to a verified domain for real sends.`,
        );
      } else if (!match) {
        this.logger.error(
          `Domain "${sendingDomain}" is not registered in Resend. Add it under Domains, ` +
            `publish the DNS records it gives you, then set FROM_EMAIL to an address on that domain.`,
        );
      } else if (match.status !== 'verified') {
        this.logger.error(
          `Domain "${sendingDomain}" is registered but its status is "${match.status}". ` +
            `Sends will be rejected until the DNS records are published and it verifies.`,
        );
      } else {
        this.logger.log(
          `Resend verified — domain "${sendingDomain}" is ready to send.`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Resend verification check failed: ${err.message}`);
    }
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
    if (!this.enabled || !this.resend) {
      this.logger.warn(
        this.enabled
          ? 'RESEND_API_KEY not configured. Email not sent.'
          : 'Email sending is disabled. Email not sent.',
      );
      this.logger.debug(`Would send email to: ${payload.to} | Subject: ${payload.subject}`);
      return;
    }

    try {
      // Resend reports failures in the `error` field rather than throwing.
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      });

      if (error) {
        this.logger.error(
          `Failed to send email to ${payload.to}: ${error.name} — ${error.message}`,
        );
        return;
      }

      this.logger.log(`Email sent successfully to: ${payload.to} (id: ${data?.id})`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      // Don't throw - allow app to continue even if email fails
    }
  }
}
