// "Knocked down" card (1200x630), the town_demolished email's hero: the
// attacker in their side's color, the owner's building as an outline of its
// old size over a pile of rubble with the attacker town's flag in it, and the
// rivalry's score in rubble right now. Same family as the battle card.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase";
import { RIVALRY } from "@/lib/towns/rivalry";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { getCachedCity } from "@/lib/league-city/service";
import { rubbleBySlug } from "@/lib/league-city/rubble";

export const DEMOLISHED_IMAGE_SIZE = { width: 1200, height: 630 };

const BG = "#0d0d0f";
const CREAM = "#e8dcc8";
const MUTED = "#8c8c9c";
const CARD = "#1c1c20";
const RED = "#ef4444";

interface Dev {
  github_login: string;
  avatar_url: string | null;
}

export async function renderDemolishedImage(slug: string, attacker: string, victim: string): Promise<ImageResponse> {
  const fonts = [
    { name: "Silkscreen", data: await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")), style: "normal" as const, weight: 400 as const },
  ];
  const here = RIVALRY.find((r) => r.slug === slug);
  const there = RIVALRY.find((r) => r.slug !== slug);
  const sb = getSupabaseAdmin();
  const logins = [attacker, victim].map((l) => l.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 39));
  const [{ data: devs }, rubble, flagLogo] = await Promise.all([
    sb.from("developers").select("github_login, avatar_url").in("github_login", logins).returns<Dev[]>(),
    rubbleBySlug().catch(() => ({}) as Record<string, number>),
    // The attacker town's logo, on the flag in the rubble.
    there
      ? getLeagueBySlug(there.slug)
          .then((l) => (l ? getCachedCity(l.id) : null))
          .then((c) => c?.identity.logoUrl ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const find = (l: string): Dev => devs?.find((d) => d.github_login.toLowerCase() === l) ?? { github_login: l, avatar_url: null };
  const atk = find(logins[0]);
  const def = find(logins[1]);
  const atkColor = there?.color ?? RED;
  const homeColor = here?.color ?? MUTED;

  const avatar = (dev: Dev, color: string, size: number) =>
    dev.avatar_url ? (
      <img src={dev.avatar_url} alt="" width={size} height={size} style={{ border: `5px solid ${color}` }} />
    ) : (
      <div style={{ display: "flex", width: size, height: size, backgroundColor: CARD, border: `5px solid ${color}` }} />
    );

  // The pile: dark blocks of wall with a few lit windows, some knocked askew.
  const rubbleBlocks: [number, number, number, number, number, boolean][] = [
    // x, bottom, w, h, degrees, lit window
    [-6, 0, 58, 34, -8, true],
    [44, 0, 66, 46, 5, false],
    [104, 0, 48, 30, -12, true],
    [140, 0, 50, 40, 9, false],
    [18, 28, 44, 26, 14, false],
    [86, 36, 52, 24, -6, true],
    [130, 30, 30, 20, 20, false],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          fontFamily: "Silkscreen",
          border: `6px solid ${RED}`,
          padding: "44px 56px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 8 }}>{`${(here?.name ?? "").toUpperCase()} TOWN`}</div>
          <div style={{ display: "flex", fontSize: 88, color: RED, marginTop: 4 }}>KNOCKED DOWN</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26 }}>
          {/* The attacker */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
            {avatar(atk, atkColor, 132)}
            <div style={{ display: "flex", fontSize: atk.github_login.length > 14 ? 22 : 28, color: CREAM, marginTop: 16, textTransform: "uppercase" }}>
              {atk.github_login.slice(0, 20)}
            </div>
            <div style={{ display: "flex", fontSize: 18, color: atkColor, marginTop: 6, letterSpacing: 4 }}>{`${(there?.name ?? "").toUpperCase()} SIDE`}</div>
          </div>

          {/* The owner's building: its old size, rubble, and the attacker's flag in it */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
            <div style={{ display: "flex", position: "relative", width: 180, height: 250 }}>
              <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 180, height: 250, border: `3px dashed ${homeColor}`, opacity: 0.7 }} />
              <div style={{ display: "flex", position: "absolute", left: 60, top: 62, width: 6, height: 180, backgroundColor: "#c9ccd2" }} />
              <div style={{ display: "flex", position: "absolute", left: 57, top: 54, width: 12, height: 12, backgroundColor: "#e8c547" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", left: 66, top: 66, width: 96, height: 62, backgroundColor: "#11151d", border: `4px solid ${atkColor}` }}>
                {flagLogo ? <img src={flagLogo} alt="" width={56} height={56} style={{ imageRendering: "pixelated" }} /> : null}
              </div>
              {rubbleBlocks.map(([x, bottom, w, h, deg, lit], i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: x,
                    top: 250 - bottom - h + 10,
                    width: w,
                    height: h,
                    backgroundColor: i % 2 ? "#161b28" : "#222a3d",
                    border: "2px solid #0b0d14",
                    transform: `rotate(${deg}deg)`,
                  }}
                >
                  {lit ? <div style={{ display: "flex", marginLeft: 8, marginTop: 7, width: 10, height: 10, backgroundColor: homeColor }} /> : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 16, gap: 12 }}>
              {avatar(def, homeColor, 40)}
              <div style={{ display: "flex", fontSize: def.github_login.length > 14 ? 20 : 26, color: CREAM, textTransform: "uppercase" }}>{def.github_login.slice(0, 20)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 18, color: MUTED, marginTop: 6, letterSpacing: 4 }}>IN RUBBLE</div>
          </div>

          {/* The score in rubble */}
          <div style={{ display: "flex", flexDirection: "column", width: 330, gap: 18 }}>
            {[here, there].map((side) =>
              side ? (
                <div key={side.slug} style={{ display: "flex", flexDirection: "column", padding: "14px 18px", backgroundColor: CARD, borderLeft: `6px solid ${side.color}` }}>
                  <div style={{ display: "flex", fontSize: 56, color: CREAM }}>{rubble[side.slug] ?? 0}</div>
                  <div style={{ display: "flex", fontSize: 16, color: MUTED, letterSpacing: 2 }}>{`${side.name.toUpperCase()} BUILDINGS DOWN`}</div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    ),
    { ...DEMOLISHED_IMAGE_SIZE, fonts },
  );
}
