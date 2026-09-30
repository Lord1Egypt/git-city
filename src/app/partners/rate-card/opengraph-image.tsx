import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG } from "@/lib/og/devHero";

export const alt = "Git City rate card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = size.width;
const H = size.height;
const M = 56;
const FOOTER_H = 78;

// The rate card at a glance: the two packages and their cost in prizes.
const ROWS = [
  { what: "EVENT", length: "1 WEEK", cost: "5 PRIZES" },
  { what: "TOWN", length: "4 WEEKS", cost: "4 PRIZES" },
];

export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const layer = { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "100%", display: "flex" };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG.bg,
          fontFamily: "Silkscreen",
          border: `6px solid ${OG.border}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ ...layer, backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />
        <div style={{ ...layer, backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />

        <div style={{ display: "flex", flexDirection: "column", padding: `60px ${M}px 0` }}>
          <span style={{ fontSize: 18, color: OG.muted, letterSpacing: 4 }}>GIT CITY</span>
          <span style={{ marginTop: 14, fontSize: 64, color: OG.cream, lineHeight: 1 }}>RATE CARD</span>
          <span style={{ marginTop: 18, fontSize: 24, color: OG.accent }}>PAY IN PRIZES FOR DEVELOPERS, NOT MONEY</span>
        </div>

        <div style={{ display: "flex", gap: 24, padding: `44px ${M}px 0` }}>
          {ROWS.map((r) => (
            <div
              key={r.what}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                flexBasis: 0,
                border: `3px solid ${OG.border}`,
                backgroundColor: OG.cardBg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "16px 22px",
                  borderBottom: `3px solid ${OG.border}`,
                }}
              >
                <span style={{ fontSize: 32, color: OG.cream }}>{r.what}</span>
                <span style={{ fontSize: 16, color: OG.muted }}>{r.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "16px 22px 20px" }}>
                <span style={{ fontSize: 14, color: OG.muted, letterSpacing: 2 }}>COST TO YOUR BRAND</span>
                <span style={{ marginTop: 8, fontSize: 40, color: OG.accent }}>{r.cost}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            top: H - FOOTER_H,
            width: W,
            height: FOOTER_H,
            borderTop: `4px solid ${OG.accent}`,
            backgroundColor: "#141418",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${M}px 9px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 26, color: OG.cream }}>GIT</span>
            <span style={{ fontSize: 26, color: OG.accent }}>CITY</span>
          </div>
          <span style={{ fontSize: 18, color: OG.muted }}>THEGITCITY.COM/PARTNERS/RATE-CARD</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }] },
  );
}
