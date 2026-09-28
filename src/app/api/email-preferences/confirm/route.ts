import { NextResponse } from "next/server";
import { PREFERENCES_TOKEN_SCOPE, verifyHmacToken } from "@/lib/notifications";
import { updatePreferences } from "@/lib/email/preferences";
import { recordConsent } from "@/lib/consent";

/**
 * POST /api/email-preferences/confirm  { dev, token, campaign }
 * "Yes, keep me posted" from a permission email: product news stays on and
 * the confirmation is logged against the campaign, which spares the player
 * from that campaign's sunset.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { dev?: unknown; token?: unknown; campaign?: unknown } | null;
  const devId = Number(body?.dev);
  const token = typeof body?.token === "string" ? body.token : "";
  const campaignId = Number(body?.campaign) || null;
  if (!Number.isInteger(devId) || devId <= 0 || !token || !verifyHmacToken(devId, PREFERENCES_TOKEN_SCOPE, token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  }

  const { error } = await updatePreferences(devId, { product_news: true }, "preference_page");
  if (error && error !== "No valid fields to update") return NextResponse.json({ error }, { status: 500 });
  await recordConsent({ developerId: devId, topic: "product_news", action: "confirmed", source: "preference_page", campaignId });
  return NextResponse.json({ ok: true });
}
