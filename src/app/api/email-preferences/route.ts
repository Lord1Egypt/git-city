import { NextResponse } from "next/server";
import { PREFERENCES_TOKEN_SCOPE, verifyHmacToken } from "@/lib/notifications";
import { updatePreferences } from "@/lib/email/preferences";

/**
 * POST /api/email-preferences  { dev, token, update }
 * Saves a change from the no-login preference page. The HMAC token from the
 * email footer is the proof; no session needed.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { dev?: unknown; token?: unknown; update?: unknown } | null;
  const devId = Number(body?.dev);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!Number.isInteger(devId) || devId <= 0 || !token || !verifyHmacToken(devId, PREFERENCES_TOKEN_SCOPE, token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  }
  if (!body?.update || typeof body.update !== "object") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await updatePreferences(devId, body.update as Record<string, unknown>, "preference_page");
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
