import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";

// Toggle a cosmetic's live/draft state (is_active). The "approve → live"
// gate: nothing reaches players until an admin flips it on here.

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdminGithubLogin(getGithubLoginFromUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: { is_active?: unknown; rarity?: unknown; price_usd_cents?: unknown; price_pixels?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: { is_active?: boolean; rarity?: string | null; price_usd_cents?: number; price_pixels?: number | null } = {};
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (body.rarity !== undefined) {
    const valid = ["common", "rare", "epic", "legendary"];
    if (body.rarity === null || body.rarity === "") patch.rarity = null;
    else if (typeof body.rarity === "string" && valid.includes(body.rarity)) patch.rarity = body.rarity;
    else return NextResponse.json({ error: "invalid rarity" }, { status: 400 });
  }
  if (body.price_usd_cents !== undefined) {
    const c = body.price_usd_cents;
    if (typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 100_000_00) patch.price_usd_cents = c;
    else return NextResponse.json({ error: "invalid price_usd_cents" }, { status: 400 });
  }
  if (body.price_pixels !== undefined) {
    const p = body.price_pixels;
    if (p === null) patch.price_pixels = null;
    else if (typeof p === "number" && Number.isInteger(p) && p >= 0 && p <= 10_000_000) patch.price_pixels = p;
    else return NextResponse.json({ error: "invalid price_pixels" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("items").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, ...patch });
}

