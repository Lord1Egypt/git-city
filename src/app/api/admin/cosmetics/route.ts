import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";

// Full cosmetic catalog for the admin gallery (management is complete even
// for items that don't yet have a 3D preview).

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdminGithubLogin(getGithubLoginFromUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  // select("*") returns whatever columns exist — so this works whether or
  // not migration 094 (the `rarity` column) has run yet. Missing columns
  // simply come back undefined; the gallery treats absent rarity as "—".
  const { data, error } = await admin
    .from("items")
    .select("*")
    .order("zone", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
