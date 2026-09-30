import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG } from "@/lib/og/devHero";
import { getExampleTown } from "./example";

export const alt = "Git City for communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = size.width;
const H = size.height;

// One short line and one picture, like the cards in ogimage.gallery: the
// promise on the left, a real community town filling the right.

export default async function Image() {
  const [font, town] = await Promise.all([readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")), getExampleTown()]);
  const photo = town?.cover ?? null;
  const fonts = [{ name: "Silkscreen", data: font, style: "normal" as const }];

  const line = (fontSize: number) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize, lineHeight: 1.15, color: OG.cream }}>YOUR COMMUNITY</span>
      <span style={{ fontSize, lineHeight: 1.15, color: OG.accent }}>CODES.</span>
    </div>
  );

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: OG.bg, fontFamily: "Silkscreen" }}>
      <div style={{ width: 560, height: H, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px" }}>
        {line(66)}
      </div>
      {photo && (
         
        <img src={photo} alt="" width={W - 560} height={H} style={{ width: W - 560, height: H, objectFit: "cover" }} />
      )}
    </div>,
    { ...size, fonts },
  );
}
