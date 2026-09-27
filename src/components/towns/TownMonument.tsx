"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import MergedStatic from "@/components/MergedStatic";
import { Billboard, Flag } from "@/components/league/identity/IdentityPieces";
import { PLATE_BG, clothTexture, loadLogoImage, logoTexture, wideTexture, type LogoImage } from "@/components/league/identity/logoTexture";

// The monument at the centre of the downtown plaza: the town that coded the
// most this week (per dev) gets it. Built from the town's approved identity
// pieces (pixel logo, wide billboard, banner flag) plus a plaque with the
// title and the score. Without a winner it stands empty and asks for one.
//
// Sizes are plaza-local units (the plaza group is scaled 0.55 with the SF map;
// the Founder Spire is 800 tall at 360 east). The home camera looks down at
// ~60°, so every lettered face that can tilt back toward it does.

export interface MonumentTown {
  slug: string;
  name: string;
  logoUrl: string | null;
  perDev: number;
  coding: number;
}

/** obelisk: tall shaft, banner on top, billboard at its foot. trophy: plinth, giant spinning logo, flag on a pole. gate: arch with the billboard across it and two banners. */
export type MonumentVariant = "obelisk" | "trophy" | "gate";

export const MONUMENT_VARIANTS: readonly MonumentVariant[] = ["obelisk", "trophy", "gate"];
/** The one the main city shows. */
export const MONUMENT_VARIANT: MonumentVariant = "gate";

type MonumentWindowFlags = Window & {
  __monumentClicked?: boolean;
  __monumentCursor?: boolean;
};

/** Turns the front (the plaque side) toward the home camera, which sits at (-500, +850) from downtown. */
const HOME_FACING = Math.atan2(-500, 850) + Math.PI;

/** Everything below is modelled at this fraction of its size on the plaza. */
const MONUMENT_SCALE = 1.5;

const FONT = "Silkscreen, monospace";
const STONE = "#232a36";
const STONE_DARK = "#161b24";
const LIME = "#c8e64a";
const GOLD = "#e8c547";

// ─── Textures ────────────────────────────────────────────────

function pixelTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): void {
  let s = size;
  ctx.font = `${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 2;
    ctx.font = `${s}px ${FONT}`;
  }
}

/** Plaque (8:3): "TOWN OF THE WEEK" over the score, or over the call to create one. */
/** Before launch: the billboard announces Towns and its date. */
function teaserWideTexture(date: string): THREE.CanvasTexture {
  const [c, ctx] = emptyCanvas(256, 128);
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 120);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, "GIT CITY TOWNS", 220, 26);
  ctx.fillText("GIT CITY TOWNS", 128, 40);
  ctx.fillStyle = LIME;
  fitFont(ctx, date, 220, 44);
  ctx.fillText(date, 128, 88);
  return pixelTexture(c);
}

function plaqueTexture(town: MonumentTown | null, teaser = false): THREE.CanvasTexture {
  const W = 256;
  const H = 96;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = town ? GOLD : LIME;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = town ? GOLD : "#8a93a3";
  fitFont(ctx, "TOWN OF THE WEEK", W - 24, 22);
  ctx.fillText("TOWN OF THE WEEK", W / 2, 28);
  const main = town ? `${Math.round(town.perDev).toLocaleString("en-US")} PER DEV` : teaser ? "SOON" : "CREATE A TOWN";
  ctx.fillStyle = town ? "#ffffff" : LIME;
  fitFont(ctx, main, W - 24, 34);
  ctx.fillText(main, W / 2, 64);
  return pixelTexture(c);
}

/** Stand-in for the logo on the empty monument: a "?" in a dashed frame, 64×64. */
function drawEmptyLogo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(x, y, 64, 64);
  ctx.fillStyle = LIME;
  for (let i = 4; i < 60; i += 8) {
    ctx.fillRect(x + i, y + 4, 4, 3);
    ctx.fillRect(x + i, y + 57, 4, 3);
    ctx.fillRect(x + 4, y + i, 3, 4);
    ctx.fillRect(x + 57, y + i, 3, 4);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `36px ${FONT}`;
  ctx.fillText("?", x + 32, y + 34);
}

function emptyCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(0, 0, w, h);
  return [c, ctx];
}

function emptyLogoTexture(): THREE.CanvasTexture {
  const [c, ctx] = emptyCanvas(64, 64);
  drawEmptyLogo(ctx, 0, 0);
  return pixelTexture(c);
}

/** The empty billboard: "YOUR TOWN / HERE" on two lines, big enough to read from the home camera. */
function emptyWideTexture(): THREE.CanvasTexture {
  const [c, ctx] = emptyCanvas(256, 128);
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(4, 4, 248, 120);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, "YOUR TOWN", 228, 40);
  ctx.fillText("YOUR TOWN", 128, 44);
  ctx.fillText("HERE", 128, 88);
  return pixelTexture(c);
}

/** The empty banner: the "?" stand-in centred on the plate, like a logo on its cloth. */
function emptyClothTexture(): THREE.CanvasTexture {
  const [c, ctx] = emptyCanvas(96, 64);
  drawEmptyLogo(ctx, 16, 0);
  return pixelTexture(c);
}

function useLogo(url: string | null): LogoImage | null {
  const [logo, setLogo] = useState<{ url: string; img: LogoImage } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    loadLogoImage(url)
      .then((img) => live && setLogo({ url, img }))
      .catch(() => live && setLogo(null));
    return () => {
      live = false;
    };
  }, [url]);
  return url && logo?.url === url ? logo.img : null;
}

function useFontReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (document.fonts?.load("40px Silkscreen") ?? Promise.resolve())
      .catch(() => null)
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

interface MonumentTextures {
  /** Identity of this texture set, to rebuild merged geometry when it changes. */
  id: string;
  wide: THREE.Texture;
  cloth: THREE.Texture;
  logo: THREE.Texture;
  plaque: THREE.Texture;
}

function useMonumentTextures(town: MonumentTown | null, teaser: string | null): MonumentTextures {
  const logo = useLogo(town?.logoUrl ?? null);
  const fontReady = useFontReady();
  const tex = useMemo<MonumentTextures>(
    () => ({
      id: `${town?.slug ?? "-"}:${town?.name ?? ""}:${town?.perDev ?? ""}:${logo ? "l" : "n"}:${fontReady ? "f" : "-"}:${teaser ?? ""}`,
      wide: town ? wideTexture(logo, town.name) : teaser ? teaserWideTexture(teaser) : emptyWideTexture(),
      cloth: town ? clothTexture(logo, town.name) : emptyClothTexture(),
      logo: town && logo ? logoTexture(logo) : emptyLogoTexture(),
      plaque: plaqueTexture(town, !!teaser),
    }),
    // fontReady: redraw once Silkscreen is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logo, town?.slug, town?.name, town?.perDev, fontReady, teaser],
  );
  useEffect(
    () => () => {
      tex.wide.dispose();
      tex.cloth.dispose();
      tex.logo.dispose();
      tex.plaque.dispose();
    },
    [tex],
  );
  return tex;
}

// ─── Parts ───────────────────────────────────────────────────

/** A lit face, like the identity pieces: the texture glows so it reads at night. */
function Face({ map, w, h, glow = 0.7 }: { map: THREE.Texture; w: number; h: number; glow?: number }) {
  return (
    <mesh>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={glow} roughness={0.9} />
    </mesh>
  );
}

function Box({ at, size, color = STONE, glow = 0.3, rot }: { at: [number, number, number]; size: [number, number, number]; color?: string; glow?: number; rot?: [number, number, number] }) {
  return (
    <mesh position={at} rotation={rot}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.85} />
    </mesh>
  );
}

function Lime({ at, size }: { at: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={0.9} toneMapped={false} />
    </mesh>
  );
}

/**
 * The plaque: a stone tablet leaning back toward the camera on a low base,
 * its lettered face `w`×`h`, the bottom edge's centre at (0, 0, z).
 */
function Plaque({ map, w, z, tilt = 0.95 }: { map: THREE.Texture; w: number; z: number; tilt?: number }) {
  const h = (w * 3) / 8;
  const base = 14;
  const y = base + (h / 2) * Math.cos(tilt);
  const zc = z - (h / 2) * Math.sin(tilt);
  return (
    <group>
      <Box at={[0, base / 2, zc]} size={[w + 20, base, h * Math.sin(tilt) + 50]} color={STONE_DARK} />
      <group position={[0, y, zc]} rotation={[-tilt, 0, 0]}>
        <Box at={[0, 0, -12]} size={[w + 16, h + 16, 24]} />
        <group position={[0, 0, 0.6]}>
          <Face map={map} w={w} h={h} glow={0.85} />
        </group>
      </group>
    </group>
  );
}

/** One of the approved banner flags, scaled up to monument size. */
function BigFlag({ at, scale, map, rot = 0, phase = 0 }: { at: [number, number, number]; scale: number; map: THREE.Texture; rot?: number; phase?: number }) {
  return (
    <group position={at} scale={scale}>
      <Flag position={[0, 0]} rot={rot} map={map} phase={phase} />
    </group>
  );
}

// ─── Variants ────────────────────────────────────────────────

/** Tall square shaft on stepped base, banner flag on the tip, the wide billboard at its foot. */
function Obelisk({ tex }: { tex: MonumentTextures }) {
  const shaftTop = 330;
  return (
    <>
      <MergedStatic key={tex.id}>
        <Box at={[0, 10, 0]} size={[300, 20, 300]} color={STONE_DARK} />
        <Box at={[0, 30, 0]} size={[250, 20, 250]} />
        <Box at={[0, 90, 0]} size={[170, 100, 170]} color={STONE_DARK} />
        <Lime at={[0, 143, 0]} size={[174, 6, 174]} />
        <Box at={[0, 150, 0]} size={[172, 8, 172]} color={STONE_DARK} />
        {/* Four-sided taper, turned so its faces square with the base. */}
        <mesh position={[0, 154 + (shaftTop - 154) / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[34, 66, shaftTop - 154, 4]} />
          <meshStandardMaterial color={STONE} emissive={STONE} emissiveIntensity={0.3} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, shaftTop + 26, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0, 40, 52, 4]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} roughness={0.5} flatShading />
        </mesh>
        <Lime at={[0, shaftTop - 20, 0]} size={[56, 6, 56]} />
        {/* The logo on the pedestal's four faces. */}
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <group position={[0, 90, 85.5]}>
              <Face map={tex.logo} w={80} h={80} />
            </group>
          </group>
        ))}
        <group position={[0, 0, 200]}>
          <group scale={12}>
            <Billboard position={[0, 0]} rot={0} map={tex.wide} />
          </group>
        </group>
        <Plaque map={tex.plaque} w={360} z={350} />
      </MergedStatic>
      <BigFlag at={[0, shaftTop + 52, 0]} scale={6} map={tex.cloth} />
    </>
  );
}

/** Round plinth with the logo as a giant spinning coin above it, the flag on a pole beside. */
function Trophy({ tex }: { tex: MonumentTextures }) {
  const coin = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = coin.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // A full turn every 9 s, resting face-on to the home camera in between.
    const k = Math.min(1, (t % 9) / 2.4);
    g.rotation.y = (Math.floor(t / 9) + k * k * (3 - 2 * k)) * Math.PI * 2;
    g.position.y = 330 + Math.sin(t * 1.2) * 8;
  });
  const S = 250;
  return (
    <>
      <MergedStatic key={tex.id}>
        <Box at={[0, 12, 0]} size={[320, 24, 320]} color={STONE_DARK} />
        <mesh position={[0, 24 + 70, 0]}>
          <cylinderGeometry args={[110, 125, 140, 8]} />
          <meshStandardMaterial color={STONE} emissive={STONE} emissiveIntensity={0.3} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 170, 0]}>
          <cylinderGeometry args={[120, 110, 12, 8]} />
          <meshStandardMaterial color={STONE_DARK} emissive={STONE_DARK} emissiveIntensity={0.3} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 150, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
          <torusGeometry args={[116, 4, 4, 8]} />
          <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        {/* The name on a lectern leaning out of the plinth's front. */}
        <group position={[0, 110, 150]} rotation={[-0.55, 0, 0]}>
          <Box at={[0, 0, -10]} size={[292, 152, 20]} color={STONE_DARK} />
          <group position={[0, 0, 0.6]}>
            <Face map={tex.wide} w={280} h={140} />
          </group>
        </group>
        <Box at={[0, 30, 170]} size={[300, 60, 60]} color={STONE_DARK} />
        <Plaque map={tex.plaque} w={360} z={350} />
      </MergedStatic>
      {/* The coin: logo on both faces in a gold rim, spinning over the plinth. */}
      <group ref={coin} position={[0, 330, 0]}>
        <mesh>
          <boxGeometry args={[S + 20, S + 20, 14]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
        <group position={[0, 0, 7.5]}>
          <Face map={tex.logo} w={S} h={S} glow={0.85} />
        </group>
        <group position={[0, 0, -7.5]} rotation={[0, Math.PI, 0]}>
          <Face map={tex.logo} w={S} h={S} glow={0.85} />
        </group>
      </group>
      <BigFlag at={[-190, 0, -70]} scale={9} map={tex.cloth} rot={180} />
    </>
  );
}

/** A triumphal gate: two pillars, the wide billboard across the attic front and back, a banner on each pillar. */
function Gate({ tex }: { tex: MonumentTextures }) {
  const px = 225;
  const ph = 230;
  const attic = 170;
  const top = ph + attic;
  return (
    <>
      <MergedStatic key={tex.id}>
        {[-px, px].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Box at={[0, 18, 0]} size={[110, 36, 110]} color={STONE_DARK} />
            <Box at={[0, ph / 2, 0]} size={[70, ph, 70]} />
            <Lime at={[0, ph / 2, 36]} size={[10, ph - 60, 4]} />
            <Lime at={[0, ph / 2, -36]} size={[10, ph - 60, 4]} />
          </group>
        ))}
        <Box at={[0, ph + attic / 2, 0]} size={[2 * px + 90, attic, 60]} color={STONE_DARK} />
        <Box at={[0, top + 10, 0]} size={[2 * px + 120, 20, 80]} />
        <Lime at={[0, ph + 4, 0]} size={[2 * px + 92, 8, 62]} />
        <group position={[0, ph + attic / 2 + 4, 30.6]}>
          <Face map={tex.wide} w={310} h={155} />
        </group>
        <group position={[0, ph + attic / 2 + 4, -30.6]} rotation={[0, Math.PI, 0]}>
          <Face map={tex.wide} w={310} h={155} />
        </group>
        {/* The logo on the attic's ends, either side of the name. */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (2 * px + 90) / 2 + s * 0.6, ph + attic / 2, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <Face map={tex.logo} w={54} h={54} />
          </group>
        ))}
        <Plaque map={tex.plaque} w={360} z={150} />
      </MergedStatic>
      <BigFlag at={[-px, top + 20, 0]} scale={5} map={tex.cloth} rot={180} />
      <BigFlag at={[px, top + 20, 0]} scale={5} map={tex.cloth} phase={1.4} />
    </>
  );
}

/** Invisible click volume per variant: [width, height, depth, z offset]. */
const HITBOX: Record<MonumentVariant, [number, number, number, number]> = {
  obelisk: [380, 570, 530, 100],
  trophy: [420, 480, 520, 95],
  gate: [590, 580, 260, 50],
};

// ─── Monument ────────────────────────────────────────────────

/**
 * The plaza monument. `teaser` (a date like "OCT 8") shows the pre-launch
 * billboard; without an `onClick` the monument isn't clickable.
 */
export default function TownMonument({
  town,
  variant,
  onClick,
  teaser = null,
}: {
  town: MonumentTown | null;
  variant: MonumentVariant;
  onClick?: () => void;
  teaser?: string | null;
}) {
  const tex = useMonumentTextures(town, teaser);
  const clickable = !!onClick;
  const groupRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Mesh>(null);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  const { gl, camera, scene } = useThree();

  // Capture-phase pointer handlers, like the Founder Spire: they run before
  // InstancedBuildings, which skips its own click while __monumentClicked is set.
  useEffect(() => {
    if (!clickable) return;
    const canvas = gl.domElement;
    const w = window as MonumentWindowFlags;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const hits = (e: PointerEvent): boolean => {
      const group = groupRef.current;
      const box = hitRef.current;
      if (!group || !box) return false;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const own = raycaster.intersectObject(box, false);
      if (own.length === 0) return false;
      const d = own[0].distance;
      // A building or another landmark in front takes the click.
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        if (hit.distance >= d) break;
        if ((hit.object as THREE.InstancedMesh).isInstancedMesh) return false;
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (o === group) break;
          if (o.userData?.isLandmark) return false;
        }
      }
      return true;
    };

    let tap: { time: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (hits(e)) {
        w.__monumentClicked = true;
        tap = { time: performance.now(), x: e.clientX, y: e.clientY };
      }
    };
    const onUp = (e: PointerEvent) => {
      w.__monumentClicked = false;
      if (!tap) return;
      const dt = performance.now() - tap.time;
      const dx = e.clientX - tap.x;
      const dy = e.clientY - tap.y;
      tap = null;
      if (dt > 400 || dx * dx + dy * dy > 625) return;
      onClickRef.current?.();
    };

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let last = 0;
    const onMove = isTouch
      ? null
      : (e: PointerEvent) => {
          const now = performance.now();
          if (now - last < 66) return;
          last = now;
          if (hits(e)) {
            document.body.style.cursor = "pointer";
            w.__monumentCursor = true;
          } else if (w.__monumentCursor) {
            w.__monumentCursor = false;
          }
        };

    canvas.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    if (onMove) canvas.addEventListener("pointermove", onMove, true);
    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      if (onMove) canvas.removeEventListener("pointermove", onMove, true);
      w.__monumentClicked = false;
      w.__monumentCursor = false;
    };
  }, [gl, camera, scene, clickable]);

  const [hw, hh, hd, hz] = HITBOX[variant];
  return (
    <group ref={groupRef} rotation={[0, HOME_FACING, 0]} scale={MONUMENT_SCALE} userData={{ isLandmark: true }}>
      <mesh ref={hitRef} position={[0, hh / 2, hz]} visible={false}>
        <boxGeometry args={[hw, hh, hd]} />
        <meshBasicMaterial />
      </mesh>
      {variant === "obelisk" && <Obelisk key={variant} tex={tex} />}
      {variant === "trophy" && <Trophy key={variant} tex={tex} />}
      {variant === "gate" && <Gate key={variant} tex={tex} />}
    </group>
  );
}
