import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminUser } from "@/lib/auth-identity";
import { invalidateLeague } from "@/lib/leagues/cache";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { BRASIL_SLUG, importBrasilComment, type ImportOutcome } from "@/lib/towns/brasil-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Most pasted comments one request imports (each may fetch GitHub). */
const MAX_LINES = 150;

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminUser(user) ? user : null;
}

// GET: the latest imported comments, what came of each, and the totals.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sb = getSupabaseAdmin();
  const [{ data: comments }, { count: residents }] = await Promise.all([
    sb.from("brasil_comments").select("id, reel, ig_user, github_login, uf, outcome, created_at").order("created_at", { ascending: false }).limit(150),
    sb.from("brasil_residents").select("developer_id", { count: "exact", head: true }),
  ]);
  return NextResponse.json({ comments: comments ?? [], residents: residents ?? 0 });
}

/** One pasted line: "insta_user: the comment", or just the comment. */
function splitLine(line: string): { igUser: string | null; text: string } {
  const m = /^@?([a-z0-9._]{1,30}):\s+(.+)$/i.exec(line);
  return m ? { igUser: m[1].toLowerCase(), text: m[2] } : { igUser: null, text: line };
}

// POST { action: "import", reel, comments } | { action: "remove", login }
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const league = await getLeagueBySlug(BRASIL_SLUG);
  if (!league || league.map !== "brasil") return NextResponse.json({ error: "The Brasil town isn't set up." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "remove") {
    const login = typeof body.login === "string" ? body.login.trim().replace(/^@/, "").toLowerCase() : "";
    const sb = getSupabaseAdmin();
    const { data: dev } = await sb.from("developers").select("id").eq("github_login", login).maybeSingle<{ id: number }>();
    if (!dev) return NextResponse.json({ error: `No developer @${login}.` }, { status: 404 });
    const { error } = await sb.from("brasil_residents").delete().eq("league_id", league.id).eq("developer_id", dev.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateLeague(league.id);
    return NextResponse.json({ removed: login });
  }

  if (body.action === "import") {
    const reel = typeof body.reel === "string" && body.reel.trim() ? body.reel.trim() : "pasted";
    const lines = (typeof body.comments === "string" ? body.comments : "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_LINES);
    const results: { line: string; outcome: ImportOutcome; login: string | null; uf: string | null }[] = [];
    for (const line of lines) {
      const { igUser, text } = splitLine(line);
      // A pasted comment has no platform id: the reel and the line stand for it, so pasting twice imports once.
      const id = `paste:${createHash("sha1").update(`${reel}\n${line}`).digest("hex")}`;
      try {
        const r = await importBrasilComment(league, { id, reel, igUser, text });
        results.push({ line, ...r });
      } catch (err) {
        console.error("[brasil] import", err);
        results.push({ line, outcome: "unknown_user", login: null, uf: null });
      }
    }
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
