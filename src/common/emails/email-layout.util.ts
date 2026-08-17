/**
 * Shared email layout + reusable building blocks for all transactional emails.
 *
 * Ported from the design mockups in this folder (verify-email.html,
 * otp-verification.html, login-notification.html, onboarding-welcome.html,
 * account-activity-notification.html, password-reset.html,
 * generic-notification.html). Those files stay as the visual reference; this is
 * the code that renders them with real data.
 *
 * Every scenario template (see `email-templates.ts`) is composed from these
 * helpers so branding, colours and structure stay consistent in one place.
 * Blocks emit table ROWS rather than block elements with margins: Outlook drops
 * margins on tables, so spacing lives in cell padding the way the mockups do it.
 * Styles are inlined on elements (rather than relying only on a <style> block)
 * to survive email clients such as Gmail/Outlook that strip <head> styles.
 */

export const BRAND = {
  name: 'Leviate',
  /** Wordmark, buttons, links. */
  primary: '#1B7A2B',
  /** Headings. */
  heading: '#17181A',
  /** Body copy. */
  text: '#3B4340',
  /** Secondary copy and detail labels. */
  muted: '#5B6363',
  /** Footer copy, below the card. */
  footer: '#8A9088',
  /** Page background behind the card. */
  background: '#F2F8EF',
  card: '#FFFFFF',
  cardBorder: '#E4ECE1',
  /** Inset panels (detail tables). */
  panel: '#F7FBF6',
  /** Tinted accents (codes, badges, step markers). */
  accent: '#EFFBEE',
  accentBorder: '#CFE8C9',
  supportEmail: 'support@leviateapp.com',
  website: 'https://leviateapp.com',
} as const;

const FONT = 'Arial, Helvetica, sans-serif';
/** Horizontal padding of every content row; `.fluid-pad` narrows it on mobile. */
const GUTTER = '40px';

export interface LayoutOptions {
  /** Heading shown at the top of the card. */
  title: string;
  /** Inline preview text shown by inbox clients before the body is opened. */
  preheader?: string;
  /** Optional status pill above the heading, e.g. "Payout received". */
  badge?: string;
  /** Pre-rendered table rows for the body of the message. */
  body: string;
}

/**
 * Wraps body rows in the shared, branded, responsive shell: wordmark above a
 * white card, footer below it.
 */
export function renderLayout({
  title,
  preheader,
  badge,
  body,
}: LayoutOptions): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .fluid-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .code-digit { font-size: 30px !important; letter-spacing: 6px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.background};">
${
  preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${BRAND.background};">${escapeHtml(preheader)}</div>`
    : ''
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.background};">
<tr>
<td align="center" style="padding: 40px 16px;">

<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

<tr>
<td class="fluid-pad" style="padding: 0 8px 24px 8px;">
<span style="font-family: ${FONT}; font-size: 22px; font-weight: bold; color: ${BRAND.primary}; letter-spacing: -0.3px;">${BRAND.name}</span>
</td>
</tr>

<tr>
<td style="background-color:${BRAND.card}; border-radius:12px; border:1px solid ${BRAND.cardBorder};">
<!--[if mso]>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${
  badge
    ? `<tr>
<td class="fluid-pad" style="padding: 40px ${GUTTER} 0 ${GUTTER};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="${BRAND.accent}" style="border:1px solid ${BRAND.accentBorder}; border-radius:20px; padding:5px 14px; font-family: ${FONT}; font-size:12px; font-weight:bold; color:${BRAND.primary}; letter-spacing:0.3px; text-transform:uppercase;">${escapeHtml(badge)}</td>
</tr>
</table>
</td>
</tr>`
    : ''
}
<tr>
<td class="fluid-pad" style="padding: ${badge ? '16px' : '40px'} ${GUTTER} 8px ${GUTTER}; font-family: ${FONT};">
<h1 style="margin:0; font-size:26px; line-height:1.3; color:${BRAND.heading}; font-weight:bold;">${escapeHtml(title)}</h1>
</td>
</tr>
${body}
<tr>
<td style="height:40px; line-height:40px; font-size:0;">&nbsp;</td>
</tr>
</table>

<!--[if mso]>
</td></tr></table>
<![endif]-->
</td>
</tr>

<tr>
<td class="fluid-pad" style="padding: 32px 8px 0 8px; font-family: ${FONT}; font-size:12px; line-height:1.6; color:${BRAND.footer}; text-align:center;">
Need help? Contact us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary}; text-decoration:none;">${BRAND.supportEmail}</a><br>
&copy; ${year} ${BRAND.name}. All rights reserved.
</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>`;
}

/** A body row with the standard gutters. `top` sets the space above it. */
function row(content: string, top = '12px'): string {
  return `<tr>
<td class="fluid-pad" style="padding: ${top} ${GUTTER} 0 ${GUTTER};">
${content}
</td>
</tr>`;
}

/** Greeting line. */
export function greeting(userName?: string): string {
  return paragraph(`Hey ${escapeHtml(userName?.trim() || 'there')},`);
}

/** Standard paragraph. */
export function paragraph(html: string): string {
  return row(
    `<div style="font-family: ${FONT}; font-size:16px; line-height:1.6; color:${BRAND.text};">${html}</div>`,
  );
}

/** Smaller, quieter line — expiry notes, "didn't request this?" sign-offs. */
export function fineprint(html: string): string {
  return row(
    `<div style="font-family: ${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted};">${html}</div>`,
    '20px',
  );
}

/** Prominent, tappable call-to-action button. */
export function button(text: string, url: string): string {
  return row(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="${BRAND.primary}" style="border-radius:8px;">
<a href="${url}" style="display:block; padding:14px 28px; font-family: ${FONT}; font-size:16px; font-weight:bold; color:#FFFFFF; text-decoration:none; border-radius:8px;">${escapeHtml(text)}</a>
</td>
</tr>
</table>`,
    '28px',
  );
}

/** Large highlighted code box (OTP / temporary password). */
export function codeBox(code: string, opts: { monospace?: boolean } = {}): string {
  // A temporary password is longer and case-sensitive, so it gets a smaller,
  // tighter treatment than a 6-digit OTP.
  const type = opts.monospace
    ? 'font-size:24px; letter-spacing:3px;'
    : 'font-size:38px; letter-spacing:10px;';
  return row(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="background-color:#F3FBF0; border:1px solid ${BRAND.accentBorder}; border-radius:10px;">
<tr>
<td class="code-digit" style="padding: 22px 36px; font-family: 'Courier New', Courier, monospace; ${type} font-weight:bold; color:${BRAND.primary}; text-align:center;">${escapeHtml(code)}</td>
</tr>
</table>`,
    '32px',
  );
}

type BoxTone = 'info' | 'warning' | 'success' | 'danger';

const TONE: Record<BoxTone, { bg: string; border: string }> = {
  info: { bg: BRAND.panel, border: BRAND.cardBorder },
  warning: { bg: '#FFF8E6', border: '#E8D08A' },
  success: { bg: BRAND.accent, border: BRAND.accentBorder },
  danger: { bg: '#FDECEA', border: '#F0B4AE' },
};

/** Callout box for notices / warnings. */
export function noticeBox(html: string, tone: BoxTone = 'info'): string {
  const c = TONE[tone];
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.bg}; border:1px solid ${c.border}; border-radius:8px;">
<tr>
<td style="padding: 16px 20px; font-family: ${FONT}; font-size:14px; line-height:1.6; color:${BRAND.text};">${html}</td>
</tr>
</table>`,
    '24px',
  );
}

/** Key/value detail panel (amounts, IDs, campaign info). */
export function detailsTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr>
<td style="padding: 4px 0; color:${BRAND.muted}; width:40%;">${escapeHtml(label)}</td>
<td style="padding: 4px 0; color:${BRAND.heading}; font-weight:bold; text-align:right;">${value}</td>
</tr>`,
    )
    .join('');
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.panel}; border:1px solid ${BRAND.cardBorder}; border-radius:8px;">
<tr>
<td style="padding: 20px 24px; font-family: ${FONT}; font-size:14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${body}
</table>
</td>
</tr>
</table>`,
    '28px',
  );
}

/** Numbered "how to get started" list, divided by hairlines. */
export function steps(items: Array<{ title: string; description: string }>): string {
  const body = items
    .map((item, i) => {
      const last = i === items.length - 1;
      return `<tr>
<td style="padding: ${i === 0 ? '24px' : '20px'} 0 0 0; ${last ? '' : `border-bottom:1px solid ${BRAND.cardBorder};`}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="36" valign="top" style="padding: 0 0 ${last ? '0' : '20px'} 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="24" height="24" style="background-color:${BRAND.accent}; border:1px solid ${BRAND.accentBorder}; border-radius:50%;">
<tr><td align="center" valign="middle" style="font-family: ${FONT}; font-size:13px; font-weight:bold; color:${BRAND.primary};">${i + 1}</td></tr>
</table>
</td>
<td valign="top" style="padding: 0 0 ${last ? '0' : '20px'} 0; font-family: ${FONT};">
<div style="font-size:16px; font-weight:bold; color:${BRAND.heading};">${escapeHtml(item.title)}</div>
<div style="font-size:14px; line-height:1.5; color:${BRAND.muted}; padding-top:4px;">${escapeHtml(item.description)}</div>
</td>
</tr>
</table>
</td>
</tr>`;
    })
    .join('');
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.cardBorder};">
${body}
</table>`,
    '28px',
  );
}

/** Format a date for display, e.g. "12 September 2026". */
export function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format a Naira amount, e.g. 2500 -> "₦2,500.00". */
export function formatNaira(amount: number): string {
  return `&#8358;${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Escape user-supplied text before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
