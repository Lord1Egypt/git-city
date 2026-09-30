import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { rateLimit } from "@/lib/rate-limit";
import { button, callout, detailRows, heading, label, paragraph } from "@/lib/email/components";
import { renderLayout, renderText } from "@/lib/email/layout";
import { FROM_NOTIFY } from "@/lib/email/senders";

const TO = "samuel@thegitcity.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  name?: string;
  email?: string;
  company?: string;
  message?: string;
  website?: string;
  lang?: string;
};

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!rateLimit(`partners-contact:${ip}`, 3, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Hidden field only bots fill: pretend it worked.
  if (body.website) return NextResponse.json({ ok: true });

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const company = (body.company ?? "").trim();
  const message = (body.message ?? "").trim();
  const lang = body.lang === "pt" ? "PT" : "EN";

  if (
    !name ||
    name.length > 100 ||
    !EMAIL_RE.test(email) ||
    email.length > 200 ||
    !company ||
    company.length > 200
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (message.length > 2000) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const subject = `New partner: ${company}`;
  const reply = `mailto:${email}?subject=${encodeURIComponent(`Git City x ${company}`)}`;
  const html = renderLayout({
    title: subject,
    preheader: `${name} from ${company} wants to partner with Git City.`,
    body: [
      label("Partners page"),
      heading(company, undefined, " wants in"),
      paragraph(
        `${name} sent a partner request from thegitcity.com/partners. Reply to this email to answer them.`,
      ),
      detailRows([
        { label: "Name", value: name },
        { label: "Email", value: email },
        { label: "Company", value: company },
        { label: "Page language", value: lang },
      ]),
      message ? callout(message) : paragraph("No message.", { muted: true }),
      button(`Reply to ${name}`, reply),
    ].join("\n"),
    reason: "You get this because someone filled the partner form on thegitcity.com/partners.",
    links: { settingsUrl: null },
  });
  const text = renderText({
    lines: [
      `${company} wants in`,
      `${name} sent a partner request from thegitcity.com/partners.`,
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Page language: ${lang}`,
      "",
      message || "No message.",
    ],
    reason: "You get this because someone filled the partner form on thegitcity.com/partners.",
    links: { settingsUrl: null },
  });

  try {
    const { error } = await sendEmail({
      from: FROM_NOTIFY,
      to: TO,
      replyTo: email,
      subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[partners-contact] failed to send email", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
