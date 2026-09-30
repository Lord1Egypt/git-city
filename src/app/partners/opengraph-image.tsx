import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, building } from "@/lib/og/devHero";

export const alt = "Git City for brands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = size.width;
const H = size.height;
const M = 56;
const FOOTER_H = 78;
const GROUND_Y = H - FOOTER_H;

// The /towns card's language: the pixel grid, towers on the ground line, and a
// billboard on the tallest one carrying "your brand".
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
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        style={{
          ...layer,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </div>
  );
}

export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const towerLeft = W - M - 260;
  const towerH = 390;

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

      {building({
        left: towerLeft - 150,
        groundY: GROUND_Y,
        height: 230,
        width: 130,
        color: OG.borderLight,
      })}
      {building({
        left: towerLeft + 150,
        groundY: GROUND_Y,
        height: 280,
        width: 120,
        color: OG.borderLight,
      })}
      {building({
        left: towerLeft,
        groundY: GROUND_Y,
        height: towerH,
        width: 180,
        color: OG.accent,
      })}

      {/* The billboard bolted to the tallest tower. */}
      <div
        style={{
          position: "absolute",
          left: towerLeft - 70,
          top: GROUND_Y - towerH - 70,
          width: 320,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG.bg,
          border: `6px solid ${OG.accent}`,
          fontSize: 36,
          color: OG.accent,
        }}
      >
        YOUR BRAND
      </div>

      <div
        style={{
          position: "absolute",
          left: M,
          top: 70,
          width: 620,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ fontSize: 18, color: OG.muted, letterSpacing: 4 }}>GIT CITY FOR BRANDS</span>
        <span style={{ marginTop: 26, fontSize: 50, color: OG.cream, lineHeight: 1.2 }}>
          PUT YOUR BRAND
        </span>
        <span style={{ fontSize: 50, color: OG.cream, lineHeight: 1.2 }}>IN THE CITY</span>
        <span style={{ fontSize: 50, color: OG.accent, lineHeight: 1.2 }}>DEVELOPERS BUILT</span>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            border: `3px solid ${OG.border}`,
            backgroundColor: OG.cardBg,
            width: 520,
          }}
        >
          {[
            { n: "50,900", l: "SIGNED IN WITH GITHUB" },
            { n: "87,600", l: "DEVS IN THE CITY" },
          ].map((s, i) => (
            <div
              key={s.l}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                flexBasis: 0,
                padding: "12px 18px 18px",
                borderLeft: i > 0 ? `3px solid ${OG.border}` : "none",
              }}
            >
              <div style={{ display: "flex", fontSize: 34, color: i === 0 ? OG.accent : OG.cream }}>
                {s.n}
              </div>
              <div style={{ display: "flex", fontSize: 13, color: OG.muted, marginTop: 6 }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
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
        <span style={{ fontSize: 18, color: OG.muted }}>THEGITCITY.COM/PARTNERS</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }] },
  );
}
