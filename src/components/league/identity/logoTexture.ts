import * as THREE from "three";

// Canvas textures for the town's identity pieces. The logo is one texture per
// city: replacing it updates every billboard, flag and floor at once. Logos
// are pixel art (64×64, 16 colors), so they keep hard pixel edges. Without a
// logo, pieces fall back to the town name on a plate.

export const PLATE_BG = "#11151d";
const FONT = "Silkscreen, monospace";

export interface LogoImage {
  image: HTMLImageElement;
  /** The logo's edge color, used to fill cloth and panels around it. */
  edge: string;
}

export function loadLogoImage(url: string): Promise<LogoImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ image: img, edge: edgeColor(img) });
    img.onerror = reject;
    img.src = url;
  });
}

/** Most common opaque color along the image border (the logo's background). */
function edgeColor(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return PLATE_BG;
  ctx.drawImage(img, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  const counts = new Map<string, number>();
  for (let i = 0; i < 32; i++) {
    for (const [x, y] of [[i, 0], [i, 31], [0, i], [31, i]]) {
      const o = (y * 32 + x) * 4;
      if (d[o + 3] < 128) continue;
      const k = `#${[d[o], d[o + 1], d[o + 2]].map((v) => (v & 0xf0).toString(16).padStart(2, "0")).join("")}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  let best = PLATE_BG;
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return best;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function inkFor(bg: string): string {
  return luminance(bg) > 0.55 ? "#111111" : "#ffffff";
}

function pixelTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

/** Fits `text` in `maxW` px, shrinking from `size`. Returns the font size used. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, min = 10): number {
  let s = size;
  ctx.font = `${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2;
    ctx.font = `${s}px ${FONT}`;
  }
  return s;
}

/** The logo alone, pixel-sharp. */
export function logoTexture(logo: LogoImage): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(logo.image, 0, 0, 128, 128);
  return pixelTexture(c);
}

/** Wide panel (2:1): logo on the left, town name on the right; name only without a logo. */
export function wideTexture(logo: LogoImage | null, name: string): THREE.CanvasTexture {
  const H = 128;
  const W = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const bg = logo?.edge ?? PLATE_BG;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = inkFor(bg);
  ctx.textBaseline = "middle";
  if (logo) {
    ctx.drawImage(logo.image, 0, 0, H, H);
    fitText(ctx, name, W - H - 16, 40);
    ctx.fillText(name, H + 8, H / 2);
  } else {
    ctx.textAlign = "center";
    fitText(ctx, name, W - 24, 44);
    ctx.fillText(name, W / 2, H / 2);
  }
  return pixelTexture(c);
}

/**
 * A person's flag (2:1, the rubble flag): their avatar small in the middle,
 * the @login under it, shrunk to fit and cut with an ellipsis past that, so a
 * long login never runs off the cloth.
 */
export function avatarFlagTexture(avatar: LogoImage | null, name: string): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const SIDE = 72;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(0, 0, W, H);
  const x = (W - SIDE) / 2;
  const y = 12;
  if (avatar) {
    // A photo, not pixel art: scale it down smoothly.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(avatar.image, x, y, SIDE, SIDE);
  } else {
    ctx.fillStyle = "#1f2533";
    ctx.fillRect(x, y, SIDE, SIDE);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = inkFor(PLATE_BG);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = W - 20;
  fitText(ctx, name, maxW, 20, 12);
  let label = name;
  while (label.length > 2 && ctx.measureText(label).width > maxW) label = label.slice(0, -1);
  if (label !== name) label = `${label.slice(0, -1)}…`;
  ctx.fillText(label, W / 2, y + SIDE + 22);
  return pixelTexture(c);
}

/** Flag cloth (3:2): the logo centered on its edge color; the name without a logo. */
export function clothTexture(logo: LogoImage | null, name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const bg = logo?.edge ?? PLATE_BG;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 96, 64);
  if (logo) ctx.drawImage(logo.image, 16, 0, 64, 64);
  else {
    ctx.fillStyle = inkFor(bg);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, name, 88, 20, 8);
    ctx.fillText(name, 48, 32);
  }
  return pixelTexture(c);
}

/** The portal's beam (≈ 5.4:1): logo at each end, the name between. */
export function beamTexture(logo: LogoImage | null, name: string): THREE.CanvasTexture {
  const W = 384;
  const H = 72;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#c8e64a";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  const pad = logo ? H : 0;
  if (logo) {
    ctx.drawImage(logo.image, 8, 8, H - 16, H - 16);
    ctx.drawImage(logo.image, W - H + 8, 8, H - 16, H - 16);
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, name.toUpperCase(), W - 2 * pad - 24, 36);
  ctx.fillText(name.toUpperCase(), W / 2, H / 2 + 2);
  return pixelTexture(c);
}

/** Hill sign: giant white letters on a transparent sheet. Returns the texture and its aspect. */
export function hillLettersTexture(name: string): { tex: THREE.CanvasTexture; aspect: number } {
  const H = 96;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${H * 0.8}px ${FONT}`;
  const text = name.toUpperCase();
  const W = Math.min(2048, Math.ceil(probe.measureText(text).width) + 32);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4f1e8";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  fitText(ctx, text, W - 16, H * 0.8);
  ctx.fillText(text, W / 2, H / 2 + 4);
  return { tex: pixelTexture(c), aspect: W / H };
}
