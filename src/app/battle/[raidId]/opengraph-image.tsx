import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase";

export const alt = "Battle Result - Git City";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ raidId: string }>;
}) {
  const { raidId } = await params;

  const fontData = await readFile(
    join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"),
  );

  const bg = "#0d0d0f";
  const cream = "#e8dcc8";
  const muted = "#8c8c9c";
  const cardBg = "#1c1c20";
  const lime = "#c8e64a";
  const red = "#ef4444";

  const fonts = [
    { name: "Silkscreen", data: fontData, style: "normal" as const, weight: 400 as const },
  ];

  const notFound = (message: string) =>
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            fontFamily: "Silkscreen",
            color: cream,
            fontSize: 44,
            border: `6px solid #2a2a30`,
          }}
        >
          {message}
        </div>
      ),
      { ...size, fonts },
    );

  // Service role: the `raids` table is not granted to anon, and this runs
  // server-side only (key never reaches the browser).
  const supabase = getSupabaseAdmin();

  const { data: raid } = await supabase
    .from("raids")
    .select("id, attack_score, defense_score, success, attacker_id, defender_id, created_at")
    .eq("id", raidId)
    .single();

  if (!raid) return notFound("Battle not found");

  const [{ data: atk }, { data: def }] = await Promise.all([
    supabase
      .from("developers")
      .select("github_login, avatar_url")
      .eq("id", raid.attacker_id)
      .single(),
    supabase
      .from("developers")
      .select("github_login, avatar_url")
      .eq("id", raid.defender_id)
      .single(),
  ]);

  if (!atk || !def) return notFound("Battle not found");

  const win = raid.success;
  const winColor = win ? lime : red;

  const combatant = (
    dev: { github_login: string; avatar_url: string | null },
    color: string,
    label: string,
    score: number,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
      {dev.avatar_url ? (
        <img
          src={dev.avatar_url}
          alt=""
          width={150}
          height={150}
          style={{ border: `5px solid ${color}` }}
        />
      ) : (
        <div style={{ display: "flex", width: 150, height: 150, backgroundColor: cardBg, border: `5px solid ${color}` }} />
      )}
      <div style={{ display: "flex", fontSize: 30, color: cream, marginTop: 18, textTransform: "uppercase" }}>
        {dev.github_login.slice(0, 14)}
      </div>
      <div style={{ display: "flex", fontSize: 18, color: muted, marginTop: 6, letterSpacing: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 100, color, marginTop: 4 }}>{score}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: bg,
          fontFamily: "Silkscreen",
          border: `6px solid ${winColor}`,
          padding: 50,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 22, color: muted, letterSpacing: 8 }}>
            BATTLE RESULT
          </div>
          <div style={{ display: "flex", fontSize: 96, color: winColor, marginTop: 6 }}>
            {win ? "CONQUERED" : "DEFEATED"}
          </div>
        </div>

        {/* Matchup */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 56 }}>
          {combatant(atk, lime, "ATTACK", raid.attack_score)}
          <div style={{ display: "flex", fontSize: 56, color: muted, marginLeft: 50, marginRight: 50 }}>VS</div>
          {combatant(def, red, "DEFENSE", raid.defense_score)}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
