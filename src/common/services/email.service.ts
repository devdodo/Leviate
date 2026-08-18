import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as templates from '../emails/email-templates';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly host: string;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly enabled: boolean;
  /** How many messages of a broadcast to have in flight at once. */
  private readonly maxConnections: number;

  constructor(private configService: ConfigService) {
    this.host = this.configService.get<string>('SMTP_HOST') || '';
    const user = this.configService.get<string>('SMTP_USER') || '';
    const pass = this.configService.get<string>('SMTP_PASSWORD') || '';
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '465', 10);
    // secure=true is implicit TLS (port 465); false is STARTTLS (port 587).
    const secure =
      (this.configService.get<string>('SMTP_SECURE') || 'true')
        .trim()
        .toLowerCase() !== 'false';

    this.maxConnections = Math.max(
      1,
      parseInt(this.configService.get<string>('SMTP_MAX_CONNECTIONS') || '3', 10) || 3,
    );
    const rateLimit = Math.max(
      1,
      parseInt(this.configService.get<string>('SMTP_RATE_LIMIT') || '10', 10) || 10,
    );

    // A pooled transport keeps connections open across sends. Broadcasts would
    // otherwise open and tear down one SMTP session per recipient, which most
    // mailbox providers treat as abuse.
    this.transporter =
      this.host && user
        ? nodemailer.createTransport({
            host: this.host,
            port,
            secure,
            auth: { user, pass },
            pool: true,
            maxConnections: this.maxConnections,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit,
          })
        : null;

    const fromName = this.configService.get<string>('FROM_NAME') || 'Leviate';
    // Most SMTP hosts reject a From that isn't the authenticated mailbox, so
    // the mailbox itself is the safest default.
    const fromEmail = this.configService.get<string>('FROM_EMAIL') || user;
    this.from = `${fromName} <${fromEmail}>`;
    this.replyTo = this.configService.get<string>('REPLY_TO_EMAIL') || undefined;

    // Explicit off-switch for local/CI runs; defaults to on when unset.
    this.enabled =
      (this.configService.get<string>('NOTIFICATION_EMAIL_ENABLED') || 'true')
        .trim()
        .toLowerCase() !== 'false';
  }

  /**
   * Report the effective configuration at boot and confirm the SMTP host
   * accepts the credentials, so a wrong password or a blocked port is visible
   * in the startup log rather than only when the first email is attempted.
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
    if (!this.transporter) {
      this.logger.warn(
        'SMTP_HOST/SMTP_USER not configured. Email not sent.',
      );
      return;
    }

    this.logger.log(`Email provider: SMTP ${this.host} | from: ${this.from}`);
    void this.verifyConfiguration();
  }

  /** Release pooled SMTP connections on shutdown. */
  onModuleDestroy(): void {
    this.transporter?.close();
  }

  /**
   * Opens a connection and authenticates, without sending anything. This is
   * where a blocked outbound port shows up: many hosts (Render, some VPS
   * providers) firewall 465/587, and the failure looks like a timeout.
   */
  private async verifyConfiguration(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log(`SMTP verified — ${this.host} accepted the credentials.`);
    } catch (error) {
      const err = error as Error & { code?: string };
      // A cert mismatch also surfaces as ESOCKET, but the cause is the opposite
      // of a blocked port: the host answered, it just is not the name on the
      // certificate. Check it first so the hint does not misdirect.
      const isCertMismatch = /certificate|altnames/i.test(err.message);
      const hint = isCertMismatch
        ? ` SMTP_HOST is not a name on the server's TLS certificate. Use the mail server's own hostname (shown in its SMTP banner, e.g. <server>.web-hosting.com) rather than a mail.<yourdomain> alias.`
        : err.code === 'ETIMEDOUT' || err.code === 'ESOCKET'
          ? ' The host did not answer — check that outbound SMTP is not blocked by the network, and that SMTP_PORT/SMTP_SECURE match (465 = secure true, 587 = secure false).'
          : err.code === 'EAUTH'
            ? ' The credentials were rejected — SMTP_USER must be the full mailbox address and SMTP_PASSWORD that mailbox password.'
            : '';
      this.logger.error(
        `SMTP verification failed for ${this.host}: ${err.message}.${hint}`,
      );
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
  /* Broadcasts                                                     */
  /* -------------------------------------------------------------- */

  /**
   * Announce a newly published task to a batch of contributors.
   *
   * Each recipient gets their own message (personally addressed, no shared
   * To/BCC list, so nobody sees anyone else's address). Callers should hand
   * this one page of recipients at a time rather than the whole user base —
   * see `TasksService.notifyContributorsOfNewTask`.
   */
  async sendNewTaskAvailable(
    recipients: Array<{ email: string; firstName?: string | null }>,
    details: {
      campaignTitle: string;
      taskUrl: string;
      category?: string;
      platforms?: string[];
      payout?: number;
      closesAt?: Date | string;
    },
  ): Promise<{ sent: number; failed: number }> {
    const valid = recipients.filter((r) => r.email);
    if (valid.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const subject = `New task on Leviate: ${details.campaignTitle}`;
    return this.sendBatch(
      valid.map((recipient) => ({
        to: recipient.email,
        subject,
        html: templates.newTaskAvailable(details, recipient.firstName ?? undefined),
      })),
    );
  }

  /* -------------------------------------------------------------- */
  /* Delivery                                                       */
  /* -------------------------------------------------------------- */

  /**
   * Send many distinct messages.
   *
   * SMTP has no batch endpoint — each message is its own transaction — so this
   * walks the list with a small number of sends in flight, bounded by the same
   * `maxConnections` the pool is built with. Failures are counted per message
   * rather than thrown: one bad address must not abandon the rest of a
   * broadcast, and a broadcast must never fail the action that triggered it.
   */
  private async sendBatch(
    payloads: Array<{ to: string; subject: string; html: string }>,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(
        this.enabled
          ? 'SMTP_HOST/SMTP_USER not configured. Batch not sent.'
          : 'Email sending is disabled. Batch not sent.',
      );
      this.logger.debug(`Would send ${payloads.length} emails`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    let next = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = next++;
        if (index >= payloads.length) return;
        const ok = await this.deliver(payloads[index], { quiet: true });
        if (ok) sent++;
        else failed++;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.maxConnections, payloads.length) }, worker),
    );

    this.logger.log(`Batch sent: ${sent}/${payloads.length} emails (failed: ${failed})`);
    return { sent, failed };
  }

  private async sendEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(
        this.enabled
          ? 'SMTP_HOST/SMTP_USER not configured. Email not sent.'
          : 'Email sending is disabled. Email not sent.',
      );
      this.logger.debug(`Would send email to: ${payload.to} | Subject: ${payload.subject}`);
      return;
    }

    await this.deliver(payload);
  }

  /**
   * The one place a message actually reaches the transport. Never throws, so
   * callers can fire and forget; returns whether the host accepted it.
   *
   * `quiet` suppresses the per-message success log, which would otherwise
   * produce one line per recipient during a broadcast.
   */
  private async deliver(
    payload: { to: string; subject: string; html: string },
    opts: { quiet?: boolean } = {},
  ): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      });

      // A host can accept the session but reject individual recipients.
      if (info.rejected?.length) {
        this.logger.error(
          `Recipient rejected by ${this.host}: ${info.rejected.join(', ')}`,
        );
        return false;
      }

      if (!opts.quiet) {
        this.logger.log(
          `Email sent successfully to: ${payload.to} (id: ${info.messageId})`,
        );
      }
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send email to ${payload.to}: ${err.message}`,
        err.stack,
      );
      // Don't throw - allow app to continue even if email fails
      return false;
    }
  }
}
