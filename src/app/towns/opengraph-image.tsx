import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, building } from "@/lib/og/devHero";
import { RIVALRY } from "@/lib/towns/rivalry";
import { getSupabaseAdmin } from "@/lib/supabase";

export const alt = "Claude Code vs Codex - Git City Towns";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const W = size.width;
const H = size.height;
const M = 56;
const FOOTER_H = 78;
const GROUND_Y = H - FOOTER_H;
/** Counts under this read as empty: hide them, like Discover does. */
const MIN_SHOWN = 10;
/** The first battle week starts Monday, Oct 5 (00:00 UTC). */
const FIRST_BATTLE = Date.UTC(2026, 9, 5);

function rgba(hex: string, a: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
}

/** Devs on each side right now (active members). Zero when the read fails. */
async function pickedCounts(): Promise<number[]> {
  try {
    const sb = getSupabaseAdmin();
    return await Promise.all(
      RIVALRY.map(async (r) => {
        const { data: league } = await sb.from("leagues").select("id").eq("slug", r.slug).maybeSingle();
        if (!league) return 0;
        const { count } = await sb
          .from("league_members")
          .select("developer_id", { count: "exact", head: true })
          .eq("league_id", league.id)
          .eq("status", "active");
        return count ?? 0;
      }),
    );
  } catch {
    return RIVALRY.map(() => 0);
  }
}

// The profile card's grid, tinted from each side toward the seam.
function backdrop(left: string, right: string) {
  const layer = { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "100%", display: "flex" };
  return (
    <div style={layer}>
      <div style={{ ...layer, backgroundImage: `linear-gradient(90deg, ${rgba(left, 0.14)} 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 55%, ${rgba(right, 0.14)} 100%)` }} />
      <div style={{ ...layer, backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />
      <div style={{ ...layer, backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />
    </div>
  );
}

export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const [a, b] = RIVALRY;
  const picked = await pickedCounts();
  const BW = 210;
  const mainH = 400;
  const backH = 250;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: OG.bg,
          fontFamily: "Silkscreen",
          border: `6px solid ${OG.border}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {backdrop(a.color, b.color)}

        {/* One tower per side, a dim one behind each, mirrored. */}
        {building({ left: M + BW - 40, groundY: GROUND_Y, height: backH, width: 130, color: OG.borderLight })}
        {building({ left: M, groundY: GROUND_Y, height: mainH, width: BW, color: a.color })}
        {building({ left: W - M - BW - 90, groundY: GROUND_Y, height: backH, width: 130, color: OG.borderLight })}
        {building({ left: W - M - BW, groundY: GROUND_Y, height: mainH, width: BW, color: b.color })}

        {/* The matchup, centered between the towers. */}
        <div
          style={{
            position: "absolute",
            left: 330,
            top: 64,
            width: W - 660,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 18, color: OG.muted, letterSpacing: 4 }}>GIT CITY TOWNS</span>
          <span style={{ marginTop: 22, fontSize: 50, color: a.color, lineHeight: 1 }}>CLAUDE CODE</span>
          <span style={{ marginTop: 14, fontSize: 26, color: OG.dim, lineHeight: 1 }}>VS</span>
          <span style={{ marginTop: 14, fontSize: 50, color: b.color, lineHeight: 1 }}>CODEX</span>
          <div style={{ display: "flex", marginTop: 30, fontSize: 18, color: OG.accent, border: `3px solid ${OG.accent}`, padding: "6px 16px" }}>
            PICK YOUR SIDE
          </div>

          {/* Like the profile's stats strip: who's on each side, once there's a crowd. */}
          {picked.every((n) => n >= MIN_SHOWN) ? (
            <div style={{ display: "flex", marginTop: 30, width: 420, border: `3px solid ${OG.border}`, backgroundColor: OG.cardBg }}>
              {[a, b].map((side, i) => (
                <div
                  key={side.slug}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexGrow: 1,
                    flexBasis: 0,
                    padding: "11px 0 21px",
                    borderLeft: i > 0 ? `3px solid ${OG.border}` : "none",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 36, color: side.color }}>{picked[i].toLocaleString("en-US")}</div>
                  <div style={{ display: "flex", fontSize: 15, color: OG.muted, marginTop: 6 }}>PICKED</div>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ marginTop: 26, fontSize: 18, color: OG.muted, letterSpacing: 2 }}>
              {Date.now() < FIRST_BATTLE ? "BATTLE STARTS MONDAY" : "THE BATTLE IS ON"}
            </span>
          )}
        </div>

        {/* Ground line in both colors, then the footer band. */}
        <div style={{ position: "absolute", left: 0, top: GROUND_Y, width: W, height: 4, display: "flex" }}>
          <div style={{ display: "flex", width: W / 2, height: 4, backgroundColor: a.color }} />
          <div style={{ display: "flex", width: W / 2, height: 4, backgroundColor: b.color }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: GROUND_Y + 4,
            width: W,
            height: FOOTER_H - 4,
            backgroundColor: "#141418",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${M}px 13px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 26, color: OG.cream }}>GIT</span>
            <span style={{ fontSize: 26, color: OG.accent }}>CITY</span>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: OG.muted }}>THEGITCITY.COM/TOWNS</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal", weight: 400 }] },
  );
}
