/**
 * HTML templates for every scenario the platform sends mail for.
 *
 * Each function is a pure, side-effect-free renderer that returns a full HTML
 * document (via the shared branded layout). `EmailService` owns the delivery.
 *
 * Grouped by domain:
 *   - Account & auth
 *   - Wallet & payments
 *   - Campaigns / tasks (creator side)
 *   - Campaigns / tasks (contributor side)
 *   - Referrals
 *   - Verification & profile
 *   - Disputes
 *   - Admin & system
 */
import {
  BRAND,
  button,
  codeBox,
  detailsTable,
  escapeHtml,
  formatNaira,
  greeting,
  noticeBox,
  paragraph,
  renderLayout,
} from './email-layout.util';

/* ------------------------------------------------------------------ */
/* Account & auth                                                      */
/* ------------------------------------------------------------------ */

export function emailVerificationOtp(otp: string, userName?: string): string {
  return renderLayout({
    title: 'Verify your email',
    preheader: `Your ${BRAND.name} verification code is ${otp}`,
    body:
      greeting(userName) +
      paragraph(`Thanks for signing up for ${BRAND.name}. Use the code below to verify your email address and activate your account:`) +
      codeBox(otp) +
      paragraph('This code will expire in <strong>15 minutes</strong>.') +
      paragraph(`If you didn't create a ${BRAND.name} account, you can safely ignore this email.`),
  });
}

export function welcome(userName?: string): string {
  return renderLayout({
    title: `Welcome to ${BRAND.name}!`,
    preheader: 'Your account is verified and ready to go.',
    body:
      greeting(userName) +
      paragraph('Your email has been verified and your account is now active. 🎉') +
      paragraph(`You can now start using ${BRAND.name} to connect creators with contributors.`) +
      noticeBox('Your starting reputation score is <strong>75</strong>. Complete tasks successfully to grow it over time.', 'info') +
      button('Go to Dashboard', BRAND.website),
  });
}

export function passwordReset(temporaryPassword: string, userName?: string): string {
  return renderLayout({
    title: 'Password reset',
    preheader: 'A temporary password has been generated for your account.',
    body:
      greeting(userName) +
      paragraph('Your password has been reset. Use the temporary password below to log in:') +
      codeBox(temporaryPassword, { monospace: true }) +
      noticeBox('<strong>Important:</strong> For your security, change this password immediately after logging in.', 'warning') +
      paragraph("If you didn't request this reset, please contact support right away."),
  });
}

export function passwordChanged(userName?: string): string {
  return renderLayout({
    title: 'Your password was changed',
    preheader: 'This is a confirmation that your password was updated.',
    body:
      greeting(userName) +
      paragraph('This is a confirmation that the password for your ' + BRAND.name + ' account was just changed.') +
      noticeBox(`If you did <strong>not</strong> make this change, contact us immediately at <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a>.`, 'danger'),
  });
}

export function accountSuspended(reason?: string, userName?: string): string {
  return renderLayout({
    title: 'Account suspended',
    preheader: 'Your account access has been temporarily restricted.',
    body:
      greeting(userName) +
      paragraph('Your ' + BRAND.name + ' account has been suspended and access is temporarily restricted.') +
      (reason ? noticeBox(`<strong>Reason:</strong> ${escapeHtml(reason)}`, 'warning') : '') +
      paragraph(`If you believe this was a mistake, contact us at <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a>.`),
  });
}

export function accountReactivated(userName?: string): string {
  return renderLayout({
    title: 'Account reactivated',
    preheader: 'Your account has been reinstated.',
    body:
      greeting(userName) +
      paragraph('Good news — your ' + BRAND.name + ' account has been reactivated and you now have full access again.') +
      button('Log In', BRAND.website),
  });
}

/* ------------------------------------------------------------------ */
/* Wallet & payments                                                   */
/* ------------------------------------------------------------------ */

export function withdrawalOtp(otp: string, userName?: string, amount?: number): string {
  return renderLayout({
    title: 'Withdrawal verification',
    preheader: `Your withdrawal OTP is ${otp}`,
    body:
      greeting(userName) +
      paragraph(
        `You requested to withdraw${amount != null ? ` <strong>${formatNaira(amount)}</strong>` : ' funds'} from your ${BRAND.name} wallet. Use the code below to complete it:`,
      ) +
      codeBox(otp) +
      noticeBox('<strong>Security notice:</strong> This code expires in <strong>10 minutes</strong>. Never share it with anyone.', 'warning') +
      paragraph("If you didn't request this withdrawal, contact support immediately."),
  });
}

export function withdrawalProcessed(
  details: { amount: number; bankName?: string; accountLast4?: string; reference?: string },
  userName?: string,
): string {
  const rows: Array<[string, string]> = [['Amount', formatNaira(details.amount)]];
  if (details.bankName) rows.push(['Bank', escapeHtml(details.bankName)]);
  if (details.accountLast4) rows.push(['Account', `•••• ${escapeHtml(details.accountLast4)}`]);
  if (details.reference) rows.push(['Reference', escapeHtml(details.reference)]);
  return renderLayout({
    title: 'Withdrawal successful',
    preheader: `Your withdrawal of ${details.amount} has been processed.`,
    body:
      greeting(userName) +
      paragraph('Your withdrawal has been processed successfully and the funds are on their way to your bank account. 🎉') +
      detailsTable(rows) +
      paragraph('Bank settlement times vary, but funds usually arrive within a few minutes to a few hours.'),
  });
}

export function withdrawalFailed(
  details: { amount: number; reason?: string; reference?: string },
  userName?: string,
): string {
  const rows: Array<[string, string]> = [['Amount', formatNaira(details.amount)]];
  if (details.reference) rows.push(['Reference', escapeHtml(details.reference)]);
  return renderLayout({
    title: 'Withdrawal failed',
    preheader: 'We were unable to process your withdrawal.',
    body:
      greeting(userName) +
      paragraph('Unfortunately, we were unable to process your recent withdrawal request. The amount has been returned to your ' + BRAND.name + ' wallet.') +
      detailsTable(rows) +
      (details.reason ? noticeBox(`<strong>Reason:</strong> ${escapeHtml(details.reason)}`, 'danger') : '') +
      paragraph('Please check your bank details and try again, or contact support if the problem persists.'),
  });
}

export function payoutReceived(
  details: { amount: number; campaignTitle?: string; newBalance?: number },
  userName?: string,
): string {
  const rows: Array<[string, string]> = [['Amount', formatNaira(details.amount)]];
  if (details.campaignTitle) rows.push(['Campaign', escapeHtml(details.campaignTitle)]);
  if (details.newBalance != null) rows.push(['Wallet balance', formatNaira(details.newBalance)]);
  return renderLayout({
    title: 'You got paid! 💰',
    preheader: `${formatNaira(details.amount)} has been credited to your wallet.`,
    body:
      greeting(userName) +
      paragraph('A payout has just been credited to your ' + BRAND.name + ' wallet.') +
      detailsTable(rows) +
      button('View Wallet', BRAND.website),
  });
}

/* ------------------------------------------------------------------ */
/* Campaigns / tasks — creator side                                    */
/* ------------------------------------------------------------------ */

export function newApplicationReceived(
  details: { campaignTitle: string; applicantName?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'New application received',
    preheader: `Someone applied to "${details.campaignTitle}"`,
    body:
      greeting(userName) +
      paragraph(
        `${details.applicantName ? `<strong>${escapeHtml(details.applicantName)}</strong>` : 'A contributor'} has applied to your campaign <strong>${escapeHtml(details.campaignTitle)}</strong>.`,
      ) +
      paragraph('Review their profile and application to approve or decline them.') +
      button('Review Application', BRAND.website),
  });
}

/* ------------------------------------------------------------------ */
/* Campaigns / tasks — contributor side                                */
/* ------------------------------------------------------------------ */

export function applicationApproved(
  details: { campaignTitle: string; payout?: number },
  userName?: string,
): string {
  return renderLayout({
    title: 'Application approved 🎉',
    preheader: `You've been approved for "${details.campaignTitle}"`,
    body:
      greeting(userName) +
      paragraph(`Great news! Your application for <strong>${escapeHtml(details.campaignTitle)}</strong> has been approved.`) +
      (details.payout != null
        ? noticeBox(`Complete the task successfully to earn <strong>${formatNaira(details.payout)}</strong>.`, 'success')
        : '') +
      button('Start Task', BRAND.website),
  });
}

export function applicationDeclined(
  details: { campaignTitle: string; reason?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'Application update',
    preheader: `An update on your application to "${details.campaignTitle}"`,
    body:
      greeting(userName) +
      paragraph(`Thank you for your interest in <strong>${escapeHtml(details.campaignTitle)}</strong>. Unfortunately, your application was not approved this time.`) +
      (details.reason ? noticeBox(`<strong>Note:</strong> ${escapeHtml(details.reason)}`, 'info') : '') +
      paragraph('Don\'t be discouraged — there are plenty of other campaigns waiting for you.') +
      button('Browse Campaigns', BRAND.website),
  });
}

export function submissionVerified(
  details: { campaignTitle: string; payout?: number },
  userName?: string,
): string {
  return renderLayout({
    title: 'Submission verified ✅',
    preheader: `Your submission for "${details.campaignTitle}" was approved.`,
    body:
      greeting(userName) +
      paragraph(`Your submission for <strong>${escapeHtml(details.campaignTitle)}</strong> has been verified and approved.`) +
      (details.payout != null
        ? noticeBox(`<strong>${formatNaira(details.payout)}</strong> has been credited to your wallet.`, 'success')
        : '') +
      paragraph('Your reputation score has also been updated. Keep up the great work!'),
  });
}

export function submissionRejected(
  details: { campaignTitle: string; reason?: string; canResubmit?: boolean },
  userName?: string,
): string {
  return renderLayout({
    title: 'Submission needs attention',
    preheader: `Your submission for "${details.campaignTitle}" was rejected.`,
    body:
      greeting(userName) +
      paragraph(`Your submission for <strong>${escapeHtml(details.campaignTitle)}</strong> was reviewed but couldn't be approved.`) +
      (details.reason ? noticeBox(`<strong>Reason:</strong> ${escapeHtml(details.reason)}`, 'warning') : '') +
      (details.canResubmit
        ? paragraph('You can make the requested changes and resubmit.') + button('Resubmit', BRAND.website)
        : paragraph('If you have questions about this decision, please contact support.')),
  });
}

/* ------------------------------------------------------------------ */
/* Referrals                                                           */
/* ------------------------------------------------------------------ */

export function referralReward(
  details: { amount: number; referredName?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'Referral reward earned 🎁',
    preheader: `You earned ${formatNaira(details.amount)} from a referral.`,
    body:
      greeting(userName) +
      paragraph(
        `${details.referredName ? `<strong>${escapeHtml(details.referredName)}</strong>` : 'Someone you referred'} just completed the qualifying steps, and your reward has landed!`,
      ) +
      detailsTable([['Referral reward', formatNaira(details.amount)]]) +
      paragraph('Keep sharing your referral code to earn more.'),
  });
}

/* ------------------------------------------------------------------ */
/* Verification & profile                                              */
/* ------------------------------------------------------------------ */

export function ninVerificationRequired(userName?: string): string {
  return renderLayout({
    title: 'Verify your identity (NIN)',
    preheader: 'Complete NIN verification to unlock payouts.',
    body:
      greeting(userName) +
      paragraph('To keep the platform safe and to enable withdrawals, we need to verify your identity using your National Identification Number (NIN).') +
      noticeBox('Verification is quick and only needs to be done once.', 'info') +
      button('Verify Identity', BRAND.website),
  });
}

export function profileIncomplete(userName?: string): string {
  return renderLayout({
    title: 'Complete your profile',
    preheader: 'A few steps left to unlock the full experience.',
    body:
      greeting(userName) +
      paragraph('Your profile is almost there! Complete the remaining details to get better matches and unlock all features.') +
      button('Complete Profile', BRAND.website),
  });
}

export function socialVerified(
  details: { platform?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'Social account verified ✅',
    preheader: 'Your social media account has been verified.',
    body:
      greeting(userName) +
      paragraph(`Your ${details.platform ? `<strong>${escapeHtml(details.platform)}</strong> ` : 'social media '}account has been successfully verified.`) +
      paragraph('You can now apply to campaigns that require a verified social presence.'),
  });
}

export function socialRejected(
  details: { platform?: string; reason?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'Social verification update',
    preheader: 'We could not verify your social media account.',
    body:
      greeting(userName) +
      paragraph(`We were unable to verify your ${details.platform ? `<strong>${escapeHtml(details.platform)}</strong> ` : 'social media '}account.`) +
      (details.reason ? noticeBox(`<strong>Reason:</strong> ${escapeHtml(details.reason)}`, 'warning') : '') +
      paragraph('Please double-check the details and submit again.') +
      button('Try Again', BRAND.website),
  });
}

/* ------------------------------------------------------------------ */
/* Disputes                                                            */
/* ------------------------------------------------------------------ */

export function disputeOpened(
  details: { disputeId: string; campaignTitle?: string },
  userName?: string,
): string {
  const rows: Array<[string, string]> = [['Dispute ID', escapeHtml(details.disputeId)]];
  if (details.campaignTitle) rows.push(['Campaign', escapeHtml(details.campaignTitle)]);
  return renderLayout({
    title: 'Dispute received',
    preheader: 'We have logged your dispute and are reviewing it.',
    body:
      greeting(userName) +
      paragraph('We\'ve received your dispute and our team is reviewing it. We\'ll keep you updated on the outcome.') +
      detailsTable(rows) +
      paragraph('Most disputes are resolved within a few business days.'),
  });
}

export function disputeResolved(
  details: { disputeId: string; outcome?: string },
  userName?: string,
): string {
  return renderLayout({
    title: 'Dispute resolved',
    preheader: 'There is an update on your dispute.',
    body:
      greeting(userName) +
      paragraph(`Your dispute (<strong>${escapeHtml(details.disputeId)}</strong>) has been resolved.`) +
      (details.outcome ? noticeBox(`<strong>Outcome:</strong> ${escapeHtml(details.outcome)}`, 'info') : '') +
      paragraph(`If you have further questions, reach us at <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a>.`),
  });
}

/* ------------------------------------------------------------------ */
/* Admin & system                                                      */
/* ------------------------------------------------------------------ */

export function campaignTerminationAdminAlert(details: {
  campaignTitle: string;
  netRefundAmount: number;
  terminationFeeAmount: number;
  terminationRequestId: string;
}): string {
  return renderLayout({
    title: 'Campaign cancellation — action required',
    preheader: 'A creator cancelled a campaign and is owed a manual refund.',
    body:
      paragraph('Hi,') +
      paragraph('A creator has cancelled their campaign and is owed a manual refund.') +
      detailsTable([
        ['Campaign', escapeHtml(details.campaignTitle)],
        ['Termination request ID', escapeHtml(details.terminationRequestId)],
        ['Cancellation fee', formatNaira(details.terminationFeeAmount)],
        ['Net refund owed', formatNaira(details.netRefundAmount)],
      ]) +
      noticeBox('<strong>Please process this refund within 24 hours</strong> from the Admin dashboard once the transfer is arranged.', 'warning'),
  });
}

/**
 * Generic system alert — used for SYSTEM_ALERT notifications where a
 * dedicated template doesn't exist. Provide a title, message and optional CTA.
 */
export function systemAlert(
  details: { heading: string; message: string; ctaText?: string; ctaUrl?: string },
  userName?: string,
): string {
  return renderLayout({
    title: details.heading,
    preheader: details.message.slice(0, 120),
    body:
      greeting(userName) +
      paragraph(escapeHtml(details.message)) +
      (details.ctaText && details.ctaUrl ? button(details.ctaText, details.ctaUrl) : ''),
  });
}
