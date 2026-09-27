"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { SmashStore } from "@/lib/league-city/smash";

// Rivalry smash: a pixel flag planted in each building lying in rubble, in the
// attacker's side color, their @login on the cloth. The cloth always faces
// the camera (from the chase camera and from the top-down one) so the name reads. Re-reads the store only when its
// version moves (a building falls or heals).

interface Flag {
  key: string;
  x: number;
  z: number;
  by: string;
}

const POLE_H = 30;
const CLOTH_W = 30;
const CLOTH_H = 12;

/** "@login" on the side's color, drawn small and scaled up without smoothing (pixel look). */
function clothTexture(by: string, color: string): THREE.CanvasTexture {
  const text = `@${by}`.toUpperCase();
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, canvas.height - 3, canvas.width, 3);
  ctx.fillStyle = "#0b0d14";
  let size = 20;
  ctx.font = `${size}px Silkscreen, monospace`;
  while (size > 7 && ctx.measureText(text).width > canvas.width - 10) {
    size -= 1;
    ctx.font = `${size}px Silkscreen, monospace`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function RubbleFlag({ flag, color }: { flag: Flag; color: string }) {
  const [fontReady, setFontReady] = useState(false);
  // The site's pixel font (Silkscreen) may still be loading: draw again once it's in.
  useEffect(() => {
    let live = true;
    document.fonts?.load("16px Silkscreen").then(() => live && setFontReady(true)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const tex = useMemo(() => clothTexture(flag.by, color), [flag.by, color, fontReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  const cloth = useRef<THREE.Mesh>(null);
  // A little flutter.
  const phase = useMemo(() => (flag.key.length * 1.7) % 6, [flag.key]);
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.z = Math.sin(clock.elapsedTime * 2.2 + phase) * 0.04;
  });
  return (
    <group position={[flag.x, 0, flag.z]}>
      <mesh position={[0, POLE_H / 2, 0]}>
        <boxGeometry args={[0.8, POLE_H, 0.8]} />
        <meshStandardMaterial color="#c9ced8" emissive="#3a3f4a" emissiveIntensity={0.6} />
      </mesh>
      <Billboard position={[0, POLE_H - CLOTH_H / 2 - 0.5, 0]}>
        <group position={[CLOTH_W / 2 + 0.4, 0, 0]}>
          <mesh ref={cloth}>
            <planeGeometry args={[CLOTH_W, CLOTH_H]} />
            <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

export default function RubbleFlags({ store, color }: { store: SmashStore; color: string }) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const seen = useRef(-1);
  useFrame(() => {
    if (store.version === seen.current) return;
    seen.current = store.version;
    const next: Flag[] = [];
    for (const [i, by] of store.demolishedBy) {
      const t = store.targets[i];
      next.push({ key: t.login, x: t.x - t.w * 0.2, z: t.z, by });
    }
    setFlags(next);
  });
  return (
    <>
      {flags.map((f) => (
        <RubbleFlag key={`${f.key}:${f.by}`} flag={f} color={color} />
      ))}
    </>
  );
}
