// The footer the manual product-update broadcast adds to hand-written HTML.
import { COLORS, FONT, escapeHtml } from "./email/components";
import { LEGAL_NAME } from "./legal";

// ── Product-update broadcast footer ──

/**
 * Adds the unsubscribe footer to a hand-written product update. Goes before the
 * last </body> (any case); HTML without one gets it appended at the end.
 */
export function withUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const url = escapeHtml(unsubscribeUrl);
  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.bg}" style="background-color:${COLORS.bg}; background-image:linear-gradient(${COLORS.bg},${COLORS.bg});">
<tr><td align="center" style="padding:24px 20px 40px; font-family:${FONT}; font-size:13px; line-height:1.6; color:${COLORS.muted};">
You're getting this product update because you claimed your building on Git City.<br>
<a href="${url}" style="color:${COLORS.warm}; text-decoration:underline;">Unsubscribe from product updates</a> &nbsp;&middot;&nbsp; ${escapeHtml(LEGAL_NAME)}
</td></tr>
</table>`;

  const closes = [...html.matchAll(/<\/body\s*>/gi)];
  const last = closes[closes.length - 1];
  if (last?.index === undefined) return `${html}\n${footer}`;
  return `${html.slice(0, last.index)}${footer}\n${html.slice(last.index)}`;
}
