import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Uptime check: 200 when the db answers a one-row read within 5s, 503 otherwise.
export async function GET() {
  const started = Date.now();
  try {
    const { error } = await getSupabaseAdmin()
      .from("city_stats")
      .select("id")
      .eq("id", 1)
      .abortSignal(AbortSignal.timeout(5_000))
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, db_ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db_ms: Date.now() - started }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
