import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, building } from "@/lib/og/devHero";

export const alt = "Git City for communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const H = size.height;
const PANEL_X = 600;

// One short line and one picture, like the cards in ogimage.gallery: the
// promise on the left, a pixel town (Git City's buildings) filling the right.
export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  const ground = H;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: OG.bg, fontFamily: "Silkscreen" }}>
      <div style={{ width: PANEL_X, height: H, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px" }}>
        <span style={{ fontSize: 68, lineHeight: 1.15, color: OG.cream }}>YOUR</span>
        <span style={{ fontSize: 68, lineHeight: 1.15, color: OG.cream }}>COMMUNITY</span>
        <span style={{ fontSize: 68, lineHeight: 1.15, color: OG.accent }}>CODES.</span>
      </div>

      {/* The community's town: members as buildings, the top coder the tallest and lit. */}
      {building({ left: PANEL_X + 10, groundY: ground, height: 250, width: 110, color: OG.borderLight })}
      {building({ left: PANEL_X + 130, groundY: ground, height: 380, width: 130, color: OG.borderLight })}
      {building({ left: PANEL_X + 270, groundY: ground, height: 520, width: 150, color: OG.accent })}
      {building({ left: PANEL_X + 430, groundY: ground, height: 330, width: 120, color: OG.borderLight })}
    </div>,
    { ...size, fonts: [{ name: "Silkscreen", data: font, style: "normal" }] },
  );
}
