import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG } from "@/lib/og/devHero";

export const alt = "Git City for communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const M = 72;

// The page's promise and nothing else: two big lines and the name.
export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: M,
        backgroundColor: OG.bg,
        border: `6px solid ${OG.border}`,
        fontFamily: "Silkscreen",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 76, lineHeight: 1.15, color: OG.cream }}>YOUR COMMUNITY</span>
        <span style={{ fontSize: 76, lineHeight: 1.15, color: OG.cream }}>CODES.</span>
        <span style={{ marginTop: 24, fontSize: 76, lineHeight: 1.15, color: OG.accent }}>BRANDS PAY</span>
        <span style={{ fontSize: 76, lineHeight: 1.15, color: OG.accent }}>THE PRIZES.</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 30, color: OG.cream }}>GIT</span>
        <span style={{ fontSize: 30, color: OG.accent }}>CITY</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }] },
  );
}
