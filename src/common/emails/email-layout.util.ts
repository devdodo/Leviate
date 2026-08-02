/**
 * Shared email layout + reusable building blocks for all transactional emails.
 *
 * Every scenario template (see `email-templates.ts`) is composed from these
 * helpers so branding, colours and structure stay consistent in one place.
 * Styles are inlined on elements (rather than relying only on a <style> block)
 * to survive email clients such as Gmail/Outlook that strip <head> styles.
 */

export const BRAND = {
  name: 'Leviate',
  primary: '#667eea',
  primaryDark: '#764ba2',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  text: '#333333',
  muted: '#666666',
  background: '#f4f4f7',
  card: '#ffffff',
  supportEmail: 'support@leviateapp.com',
  website: 'https://leviateapp.com',
} as const;

export interface LayoutOptions {
  /** Heading shown in the coloured header band. */
  title: string;
  /** Inline preview text shown by inbox clients before the body is opened. */
  preheader?: string;
  /** Pre-rendered HTML for the body of the message. */
  body: string;
}

/**
 * Wraps body HTML in the shared, branded, responsive shell.
 */
export function renderLayout({ title, preheader, body }: LayoutOptions): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background: ${BRAND.background}; }
    a { color: ${BRAND.primary}; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-content { padding: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:${BRAND.background}; font-family: Arial, Helvetica, sans-serif; color:${BRAND.text};">
  ${
    preheader
      ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background}; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background:${BRAND.card}; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND.gradient}; padding:32px; text-align:center;">
              <div style="color:#ffffff; font-size:22px; font-weight:bold; letter-spacing:0.5px;">${BRAND.name}</div>
              <div style="color:#ffffff; font-size:18px; margin-top:8px; opacity:0.95;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="email-content" style="padding:32px; line-height:1.6; font-size:15px; color:${BRAND.text};">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background:#fafafb; border-top:1px solid #ececf1; text-align:center; color:${BRAND.muted}; font-size:12px; line-height:1.6;">
              <p style="margin:0 0 6px;">Need help? Contact us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary}; text-decoration:none;">${BRAND.supportEmail}</a></p>
              <p style="margin:0;">&copy; ${year} ${BRAND.name}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Greeting line. */
export function greeting(userName?: string): string {
  return `<p style="margin:0 0 16px;">Hi ${escapeHtml(userName?.trim() || 'there')},</p>`;
}

/** Standard paragraph. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`;
}

/** Prominent, tappable call-to-action button. */
export function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="border-radius:8px; background:${BRAND.primary};">
        <a href="${url}" style="display:inline-block; padding:13px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">${escapeHtml(text)}</a>
      </td>
    </tr>
  </table>`;
}

/** Large highlighted code box (OTP / temporary password). */
export function codeBox(code: string, opts: { monospace?: boolean } = {}): string {
  const font = opts.monospace
    ? 'font-family:Consolas,Menlo,monospace; font-size:22px; letter-spacing:2px;'
    : 'font-size:32px; letter-spacing:6px;';
  return `<div style="background:#f6f7fb; border:2px dashed ${BRAND.primary}; padding:20px; text-align:center; margin:20px 0; border-radius:8px;">
    <div style="${font} font-weight:bold; color:${BRAND.primary};">${escapeHtml(code)}</div>
  </div>`;
}

type BoxTone = 'info' | 'warning' | 'success' | 'danger';

const TONE: Record<BoxTone, { bg: string; border: string }> = {
  info: { bg: '#eef2ff', border: '#667eea' },
  warning: { bg: '#fff8e6', border: '#f0ad4e' },
  success: { bg: '#e9f7ef', border: '#28a745' },
  danger: { bg: '#fdecea', border: '#dc3545' },
};

/** Coloured callout box for notices / warnings. */
export function noticeBox(html: string, tone: BoxTone = 'info'): string {
  const c = TONE[tone];
  return `<div style="background:${c.bg}; border-left:4px solid ${c.border}; padding:14px 16px; margin:20px 0; border-radius:4px; font-size:14px;">${html}</div>`;
}

/** Key/value detail table (amounts, IDs, campaign info). */
export function detailsTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([label, value], i) =>
        `<tr>
          <td style="padding:10px 0; color:${BRAND.muted}; font-size:14px; ${i < rows.length - 1 ? 'border-bottom:1px solid #eee;' : ''}">${escapeHtml(label)}</td>
          <td style="padding:10px 0; text-align:right; font-weight:bold; font-size:14px; color:${BRAND.text}; ${i < rows.length - 1 ? 'border-bottom:1px solid #eee;' : ''}">${value}</td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafb; border:1px solid #ececf1; border-radius:8px; padding:8px 16px; margin:20px 0;">
    ${body}
  </table>`;
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
