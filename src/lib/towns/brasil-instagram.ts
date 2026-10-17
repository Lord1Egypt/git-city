// ─── Brasil town: comments from Instagram ───────────────────
// A comment on a watched reel (brasil_reels) puts its dev on the map (a
// city reel: just gives them a building in the city) and gets a reply. Comments arrive by webhook as they're written, and a sync
// reads the watched reels' comments as a safety net for any the webhook
// missed; either way a comment is imported once and answered once
// (importBrasilComment's `fresh`). The account's own comments never count.
// Server only.

import { getSupabaseAdmin } from "../supabase";
import { instagramComments, instagramMe, replyToComment } from "../instagram";
import { getLeagueBySlug } from "../leagues/service";
import { BRASIL_SLUG, importBrasilComment, type ReelKind } from "./brasil-server";
import { replyFor } from "./brasil-comments";

export interface IncomingComment {
  id: string;
  mediaId: string;
  text: string;
  igUser: string | null;
  /** The top-level comment it answers (Instagram replies only under top-level ones). */
  parentId?: string;
}

export async function handleBrasilComments(comments: IncomingComment[]): Promise<number> {
  if (!comments.length) return 0;
  const sb = getSupabaseAdmin();
  const league = await getLeagueBySlug(BRASIL_SLUG);
  if (!league || league.map !== "brasil") return 0;
  const { data: reels } = await sb
    .from("brasil_reels")
    .select("media_id, permalink, kind")
    .eq("watching", true)
    .in("media_id", [...new Set(comments.map((c) => c.mediaId))]);
  const watched = new Map((reels ?? []).map((r: { media_id: string; permalink: string | null; kind: ReelKind }) => [r.media_id, { reel: r.permalink ?? r.media_id, kind: r.kind }]));

  let fresh = 0;
  for (const c of comments) {
    const w = watched.get(c.mediaId);
    if (!w) continue;
    try {
      const r = await importBrasilComment(league, { id: `ig:${c.id}`, reel: w.reel, kind: w.kind, igUser: c.igUser, text: c.text });
      if (!r.fresh) continue;
      fresh++;
      const reply = replyFor(r.outcome, r.login, r.uf, w.kind);
      if (!reply) continue;
      await replyToComment(c.parentId ?? c.id, reply);
      await sb.from("brasil_comments").update({ replied_at: new Date().toISOString() }).eq("id", `ig:${c.id}`);
    } catch (err) {
      console.error("[brasil] instagram comment", c.id, err);
    }
  }
  return fresh;
}

/** Reads every watched reel's comments and imports the ones not seen yet. */
export async function syncBrasilReels(ownUserId: string | null): Promise<{ reels: number; fresh: number }> {
  const { data: reels } = await getSupabaseAdmin().from("brasil_reels").select("media_id").eq("watching", true);
  if (!reels?.length) return { reels: 0, fresh: 0 };
  // The account's own comments (its replies) must never count: without the stored account, ask Instagram who it is.
  const me = ownUserId ? null : await instagramMe();
  const own = { id: ownUserId ?? me?.user_id ?? null, username: me?.username?.toLowerCase() ?? null };
  let fresh = 0;
  for (const { media_id } of (reels ?? []) as { media_id: string }[]) {
    const all = await instagramComments(media_id);
    const flat: IncomingComment[] = all.flatMap((c) => [
      { id: c.id, mediaId: media_id, text: c.text, igUser: c.from?.username?.toLowerCase() ?? null, from: c.from?.id },
      ...(c.replies?.data ?? []).map((r) => ({ id: r.id, mediaId: media_id, text: r.text, igUser: r.from?.username?.toLowerCase() ?? null, from: r.from?.id, parentId: c.id })),
    ]).filter((c) => c.from && c.from !== own.id && (!own.username || c.igUser !== own.username));
    // Oldest first, so the first to comment is the first on the map.
    fresh += await handleBrasilComments(flat.reverse());
  }
  return { reels: reels?.length ?? 0, fresh };
}
