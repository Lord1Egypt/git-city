import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminUser } from "@/lib/auth-identity";
import { invalidateLeague } from "@/lib/leagues/cache";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { BRASIL_SLUG, importBrasilComment, type ImportOutcome } from "@/lib/towns/brasil-server";
import { connectInstagram, instagramMedia, subscribeToComments } from "@/lib/instagram";
import { syncBrasilReels } from "@/lib/towns/brasil-instagram";

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
// ?view=instagram: the connected account and its latest posts, each marked watched or not.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (new URL(req.url).searchParams.get("view") === "instagram") {
    const [{ data: stored }, { data: reels }] = await Promise.all([
      sb.from("instagram_account").select("username").eq("id", 1).maybeSingle<{ username: string | null }>(),
      sb.from("brasil_reels").select("media_id, permalink, watching, kind"),
    ]);
    // Not connected yet: connect with the env token, no button to press.
    let account = stored;
    let error: string | null = null;
    if (!account && process.env.INSTAGRAM_ACCESS_TOKEN) {
      try {
        const me = await connectInstagram();
        await subscribeToComments();
        account = { username: me.username };
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
    // What each watched reel has brought in so far.
    const watched = (reels ?? []).filter((r: { watching: boolean }) => r.watching) as { media_id: string; permalink: string | null; kind: string }[];
    const stats: Record<string, { comments: number; added: number }> = {};
    if (watched.length) {
      const { data: rows } = await sb.from("brasil_comments").select("reel, outcome").in("reel", watched.map((r) => r.permalink ?? r.media_id));
      for (const r of (rows ?? []) as { reel: string; outcome: string }[]) {
        const s = (stats[r.reel] ??= { comments: 0, added: 0 });
        s.comments++;
        if (r.outcome === "added") s.added++;
      }
    }
    const kindOf = new Map(watched.map((r) => [r.media_id, r.kind]));
    try {
      const media = (await instagramMedia(50)).filter((m) => m.media_product_type === "REELS" || kindOf.has(m.id));
      return NextResponse.json({
        account,
        error,
        media: media.map((m) => ({ ...m, watching: kindOf.get(m.id) ?? null, stats: stats[m.permalink] ?? stats[m.id] ?? { comments: 0, added: 0 } })),
      });
    } catch (err) {
      return NextResponse.json({ account, media: [], error: err instanceof Error ? err.message : String(err) });
    }
  }
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

  if (body.action === "watch") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!/^\d+$/.test(mediaId)) return NextResponse.json({ error: "Bad media id." }, { status: 400 });
    const { error } = await getSupabaseAdmin()
      .from("brasil_reels")
      .upsert({
        media_id: mediaId,
        permalink: typeof body.permalink === "string" ? body.permalink : null,
        caption: typeof body.caption === "string" ? body.caption.slice(0, 300) : null,
        // watching: "brasil" | "city" watches the post for that; anything else stops.
        watching: body.watching === "brasil" || body.watching === "city",
        ...(body.watching === "brasil" || body.watching === "city" ? { kind: body.watching } : {}),
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Stores the account and its token, and turns on its comment webhooks.
  if (body.action === "connect") {
    try {
      const me = await connectInstagram();
      await subscribeToComments();
      return NextResponse.json({ username: me.username });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
  }

  // Reads every watched reel's comments now (the webhook's safety net, also on the cron).
  if (body.action === "sync") {
    try {
      const { data: account } = await getSupabaseAdmin().from("instagram_account").select("ig_user_id").eq("id", 1).maybeSingle<{ ig_user_id: string | null }>();
      return NextResponse.json(await syncBrasilReels(account?.ig_user_id ?? null));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
