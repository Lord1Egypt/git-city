import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { rateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/email/components";
import { FROM_NOTIFY } from "@/lib/email/senders";

const TO = "samuel@thegitcity.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = { name?: string; email?: string; company?: string; message?: string; website?: string; lang?: string };

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
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

  if (!name || name.length > 100 || !EMAIL_RE.test(email) || email.length > 200 || !company || company.length > 200) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (message.length > 2000) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ["Company", company],
    ["Page language", lang],
    ["Message", message || "(none)"],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="margin:0 0 16px">New partner request from <b>thegitcity.com/partners</b>. Reply to this email to answer them.</p>
<table style="border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#666;vertical-align:top">${k}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table></div>`;

  try {
    const { error } = await sendEmail({
      from: FROM_NOTIFY,
      to: TO,
      replyTo: email,
      subject: `New partner: ${company}`,
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
