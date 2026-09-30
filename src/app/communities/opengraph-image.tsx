import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, building } from "@/lib/og/devHero";

export const alt = "Git City for communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = size.width;
const H = size.height;
const M = 56;
const FOOTER_H = 78;
const GROUND_Y = H - FOOTER_H;

// The /partners card's language: the pixel grid, a town on the ground line,
// the community's banner on the tallest tower and the week's prize on top.
function grid() {
  const layer = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
  };
  return (
    <div style={layer}>
      <div
        style={{
          ...layer,
          backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        style={{
          ...layer,
          backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </div>
  );
}

export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const towerLeft = W - M - 290;
  const towerH = 330;

  return new ImageResponse(
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
      {grid()}

      {/* The community's town: members as buildings, the top coder the tallest. */}
      {building({ left: towerLeft - 190, groundY: GROUND_Y, height: 150, width: 90, color: OG.borderLight })}
      {building({ left: towerLeft - 95, groundY: GROUND_Y, height: 220, width: 110, color: OG.borderLight })}
      {building({ left: towerLeft + 175, groundY: GROUND_Y, height: 250, width: 110, color: OG.borderLight })}
      {building({ left: towerLeft, groundY: GROUND_Y, height: towerH, width: 170, color: OG.accent })}

      {/* The week's prize, on the top coder's roof. */}
      <div
        style={{
          position: "absolute",
          left: towerLeft - 40,
          top: GROUND_Y - towerH - 88,
          width: 250,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG.accent,
          fontSize: 24,
          color: OG.bg,
        }}
      >
        TOP CODER WINS
      </div>

      <div
        style={{
          position: "absolute",
          left: M,
          top: 70,
          width: 600,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ fontSize: 18, color: OG.muted, letterSpacing: 4 }}>GIT CITY FOR COMMUNITIES</span>
        <span style={{ marginTop: 26, fontSize: 48, color: OG.cream, lineHeight: 1.2 }}>YOUR COMMUNITY</span>
        <span style={{ fontSize: 48, color: OG.cream, lineHeight: 1.2 }}>CODES.</span>
        <span style={{ marginTop: 18, fontSize: 48, color: OG.accent, lineHeight: 1.2 }}>BRANDS PAY</span>
        <span style={{ fontSize: 48, color: OG.accent, lineHeight: 1.2 }}>THE PRIZES.</span>
        <span style={{ marginTop: 34, fontSize: 18, color: OG.cream, lineHeight: 1.5 }}>
          CREATE YOUR COMMUNITY&apos;S TOWN.
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: GROUND_Y,
          width: W,
          height: 4,
          display: "flex",
          backgroundColor: OG.accent,
        }}
      />
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
        <span style={{ fontSize: 18, color: OG.muted }}>THEGITCITY.COM/COMMUNITIES</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }] },
  );
}
