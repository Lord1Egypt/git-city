import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getLiveSpot } from "@/lib/drift/spots";
import { medalFor } from "@/lib/drift/spots/types";

// A drift challenge's share card, in the game's broadcast bands over the
// spot's photo: the spot on the lime band, the challenger's face and score,
// "Beat it". The page links it as /drift/<spot>/og?vs=<login>; without vs it's
// the spot's own card.

const size = { width: 1200, height: 630 };
const MEDAL: Record<string, string> = { author: "#3ddc6b", gold: "#ffcf33", silver: "#cfd8e3", bronze: "#d98a4e" };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

async function dataUrl(url: string, px?: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const out = px ? await sharp(buf).resize(px, px).png().toBuffer() : buf;
    return `data:image/png;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ spot: string }> }) {
  const { spot: id } = await params;
  const spot = getLiveSpot(id);
  const vs = new URL(req.url).searchParams.get("vs");
  const login = vs && /^[A-Za-z0-9-]{1,39}$/.test(vs) ? vs : null;

  const fonts = [{ name: "Silkscreen", data: await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")), style: "normal" as const, weight: 400 as const }];
  const photo = spot
    ? `data:image/jpeg;base64,${(await sharp(await readFile(join(process.cwd(), `public/drift/${spot.id}.jpg`))).resize(1200, 630, { fit: "cover" }).blur(6).modulate({ brightness: 0.7 }).jpeg({ quality: 78 }).toBuffer()).toString("base64")}`
    : null;

  let run: { score: number; avatar: string | null } | null = null;
  if (spot && login) {
    const { data } = await getSupabaseAdmin()
      .from("drift_runs")
      .select("score, developers!inner(github_login, avatar_url)")
      .eq("spot", spot.id)
      .ilike("developers.github_login", login)
      .maybeSingle();
    const r = data as unknown as { score: number; developers: { avatar_url: string | null } } | null;
    if (r) run = { score: r.score, avatar: r.developers.avatar_url ? await dataUrl(`${r.developers.avatar_url}${r.developers.avatar_url.includes("?") ? "&" : "?"}s=200`, 200) : null };
  }
  const medal = spot && run ? medalFor(spot, run.score) : null;
  const band = { display: "flex", background: "#141417", color: "#e8dcc8", boxShadow: "0 8px 0 rgba(0,0,0,0.35)" } as const;

  return new ImageResponse(
    (
      <div style={{ ...size, display: "flex", position: "relative", background: "#0d0d0f", fontFamily: "Silkscreen", textTransform: "uppercase" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders img only */}
        {photo && <img src={photo} width={1200} height={630} style={{ position: "absolute", inset: 0 }} alt="" />}
        <div style={{ position: "absolute", left: 64, top: 64, bottom: 64, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ ...band, padding: "10px 20px", fontSize: 26, color: "#c8e64a" }}>Git City drift</div>
            <div style={{ display: "flex", background: "#c8e64a", color: "#0d0d0f", padding: "18px 32px 12px", fontSize: 120, lineHeight: 1, boxShadow: "0 8px 0 rgba(0,0,0,0.35)" }}>
              {spot?.name ?? "Drift"}
            </div>
          </div>
          {login && (
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders img only */}
              {run?.avatar && <img src={run.avatar} width={150} height={150} style={{ boxShadow: "0 8px 0 rgba(0,0,0,0.35)" }} alt="" />}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ ...band, padding: "12px 24px", fontSize: 30, textTransform: "none" }}>@{login} challenges you</div>
                <div style={{ display: "flex", alignItems: "baseline", background: "#e8dcc8", color: "#0d0d0f", padding: "12px 24px", fontSize: 76, borderLeft: medal ? `12px solid ${MEDAL[medal]}` : "none", boxShadow: "0 8px 0 rgba(0,0,0,0.35)" }}>
                  {run ? fmt(run.score) : "Beat it"}
                  {run && <span style={{ fontSize: 30, marginLeft: 24 }}>Beat it</span>}
                </div>
              </div>
            </div>
          )}
          {!login && spot && <div style={{ ...band, padding: "14px 24px", fontSize: 30, textTransform: "none", maxWidth: 900 }}>{spot.tagline}</div>}
        </div>
      </div>
    ),
    { ...size, fonts, headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" } },
  );
}
