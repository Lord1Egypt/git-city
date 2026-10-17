import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, building } from "@/lib/og/devHero";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { STATES, parseUF } from "@/lib/towns/brasil-map";
import { BRASIL_SLUG } from "@/lib/towns/brasil-server";

// The Brasil map's share card, in the communities card's layout (one short
// line, Git City buildings on the right, the tallest lit): ?at=login says
// where that dev lives, ?uf=SP names the state, nothing names the map.

const size = { width: 1200, height: 630 };
const PANEL_X = 600;
const LOGIN_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i;

async function lines(q: URLSearchParams): Promise<[string, string, string]> {
  const at = q.get("at")?.toLowerCase();
  if (at && LOGIN_RE.test(at)) {
    const league = await getLeagueBySlug(BRASIL_SLUG);
    const { data } = league
      ? await getSupabaseAdmin()
          .from("brasil_residents")
          .select("uf, developers!inner(github_login)")
          .eq("league_id", league.id)
          .eq("developers.github_login", at)
          .maybeSingle<{ uf: string | null }>()
      : { data: null };
    if (data) {
      const st = data.uf ? STATES.find((s) => s.uf === data.uf) : null;
      return [`@${at}`, "LIVES IN", st ? `${st.name}.` : "THE ISLAND."];
    }
  }
  const uf = parseUF(q.get("uf") ?? "");
  if (uf) return [STATES.find((s) => s.uf === uf)!.name, "IS ON THE", "MAP."];
  return ["BRAZIL'S", "DEV", "MAP."];
}

/** Big, but a long login or state still fits the left half. */
const fontFor = (s: string) => (s.length <= 9 ? 68 : s.length <= 13 ? 52 : s.length <= 18 ? 40 : 30);

export async function GET(req: Request) {
  const [a, b, c] = await lines(new URL(req.url).searchParams);
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const H = size.height;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: OG.bg, fontFamily: "Silkscreen" }}>
      <div style={{ width: PANEL_X, height: H, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px" }}>
        <span style={{ fontSize: fontFor(a), lineHeight: 1.15, color: OG.cream, textTransform: "uppercase" }}>{a}</span>
        <span style={{ fontSize: 68, lineHeight: 1.15, color: OG.cream }}>{b}</span>
        <span style={{ fontSize: fontFor(c), lineHeight: 1.15, color: OG.accent, textTransform: "uppercase" }}>{c}</span>
      </div>
      {building({ left: PANEL_X + 10, groundY: H, height: 250, width: 110, color: OG.borderLight })}
      {building({ left: PANEL_X + 130, groundY: H, height: 380, width: 130, color: OG.borderLight })}
      {building({ left: PANEL_X + 270, groundY: H, height: 520, width: 150, color: OG.accent })}
      {building({ left: PANEL_X + 430, groundY: H, height: 330, width: 120, color: OG.borderLight })}
    </div>,
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }], headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
  );
}
