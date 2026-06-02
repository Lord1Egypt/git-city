"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VehicleMesh } from "./RaidSequence3D";
import type { RemotePilot } from "@/lib/useFlyPresence";

// ─── Constants ──────────────────────────────────────────────
const LERP_DURATION = 0.12;
// Distance (world units) beyond which a remote pilot is drawn as a
// cheap "blip" cube instead of the full vehicle mesh. Each VehicleMesh
// has ~30 nested meshes with their own useFrame animations, so culling
// them aggressively when far away is the biggest wins for crowd perf.
const LOD_DISTANCE     = 1200;
const LOD_DISTANCE_SQ  = LOD_DISTANCE * LOD_DISTANCE;
// Stop computing/animating pilots entirely past this range.
const HARD_CULL        = 4500;
const HARD_CULL_SQ     = HARD_CULL * HARD_CULL;

// ─── Single remote pilot ────────────────────────────────────

function RemotePilotMesh({
  pilot,
  selfPosRef,
}: {
  pilot: RemotePilot;
  selfPosRef?: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const fullMeshGroupRef = useRef<THREE.Group>(null);
  const blipMeshRef = useRef<THREE.Mesh>(null);
  const labelSpriteRef = useRef<THREE.Sprite>(null);
  // Internal LOD state — only the .visible flag of children toggles, so
  // we never trigger React re-renders during gameplay.
  const lodRef = useRef<"full" | "blip" | "hidden">("full");

  const labelSprite = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(4, 4, 248, 56, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pilot.login.slice(0, 16), 128, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, [pilot.login]);

  // CanvasTexture lives on the GPU; <spriteMaterial> auto-disposes itself but
  // NOT the texture we hand it via map={...}, so without this cleanup every
  // pilot that joins/leaves leaks GPU memory.
  useEffect(() => {
    return () => {
      labelSprite.dispose();
    };
  }, [labelSprite]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    pilot.lerpTimer = Math.min(1, pilot.lerpTimer + delta / LERP_DURATION);
    const t = pilot.lerpTimer;

    const ix = pilot.prevX + (pilot.x - pilot.prevX) * t;
    const iy = pilot.prevY + (pilot.y - pilot.prevY) * t;
    const iz = pilot.prevZ + (pilot.z - pilot.prevZ) * t;
    const iyaw = lerpAngle(pilot.prevYaw, pilot.yaw, t);
    const ibank = lerpAngle(pilot.prevBank, pilot.bank, t);

    groupRef.current.position.set(ix, iy, iz);
    groupRef.current.rotation.set(0, iyaw, ibank, "YXZ");

    // ── Downed state: hide the vehicle entirely so observers actually
    //    see the kill happen (no ghost ship floating during respawn). ─
    const isDowned = pilot.downedUntil > Date.now();
    if (isDowned) {
      groupRef.current.visible = false;
      return;
    }

    // ── Distance-based LOD ───────────────────────────────
    if (selfPosRef) {
      const dx = ix - selfPosRef.current.x;
      const dz = iz - selfPosRef.current.z;
      const distSq = dx * dx + dz * dz;

      let newLod: "full" | "blip" | "hidden";
      if (distSq > HARD_CULL_SQ) newLod = "hidden";
      else if (distSq > LOD_DISTANCE_SQ) newLod = "blip";
      else newLod = "full";

      if (newLod !== lodRef.current) {
        lodRef.current = newLod;
        if (fullMeshGroupRef.current) fullMeshGroupRef.current.visible = newLod === "full";
        if (blipMeshRef.current) blipMeshRef.current.visible = newLod === "blip";
        if (labelSpriteRef.current) labelSpriteRef.current.visible = newLod !== "hidden";
        groupRef.current.visible = newLod !== "hidden";
      } else {
        // Re-show if we were just downed and now we're not
        if (!groupRef.current.visible && lodRef.current !== "hidden") {
          groupRef.current.visible = true;
        }
      }
    } else {
      // No selfPosRef — just ensure visible after downed clears
      groupRef.current.visible = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Full vehicle mesh — only visible when nearby */}
      <group ref={fullMeshGroupRef}>
        <group scale={[4, 4, 4]}>
          <VehicleMesh type={pilot.vehicle || "airplane"} />
        </group>
        <pointLight position={[0, -2, 0]} color="#f0c870" intensity={15} distance={60} />
        <pointLight position={[0, 3, -4]} color="#ffffff" intensity={5} distance={30} />
      </group>
      {/* Cheap blip — single emissive cube, used when far away */}
      <mesh ref={blipMeshRef} visible={false}>
        <boxGeometry args={[6, 6, 6]} />
        <meshBasicMaterial color="#c8e64a" toneMapped={false} />
      </mesh>
      {/* Login label — shown for both LOD levels */}
      <sprite ref={labelSpriteRef} position={[0, -12, 0]} scale={[20, 5, 1]}>
        <spriteMaterial map={labelSprite} transparent depthTest={false} />
      </sprite>
    </group>
  );
}

// ─── Main component ─────────────────────────────────────────

export default function RemotePilots({
  pilotsRef,
  selfPosRef,
}: {
  pilotsRef: React.MutableRefObject<Map<string, RemotePilot>>;
  selfPosRef?: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const [tick, setTick] = useState(0);
  // Cheap membership compare: avoid joining keys into a fresh string every
  // frame (which allocated like crazy when there were several pilots online).
  // We mirror the live key set into knownKeysRef and only re-render when it
  // actually differs. Hot path is a size check + at most N Set.has lookups.
  const knownKeysRef = useRef<Set<string>>(new Set());

  useFrame(() => {
    const current = pilotsRef.current;
    const known = knownKeysRef.current;
    let changed = current.size !== known.size;
    if (!changed) {
      for (const k of current.keys()) {
        if (!known.has(k)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      known.clear();
      for (const k of current.keys()) known.add(k);
      setTick((t) => t + 1);
    }
  });

  // tick used to trigger re-render when pilot list changes
  void tick;

  const pilots = Array.from(pilotsRef.current.entries());

  return (
    <group>
      {pilots.map(([id, pilot]) => (
        <RemotePilotMesh key={id} pilot={pilot} selfPosRef={selfPosRef} />
      ))}
    </group>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
