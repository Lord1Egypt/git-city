"use client";

import { useMemo } from "react";
import { GRASS } from "@/components/race/TrackScene";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { Track } from "@/lib/league-city/race/track";
import { bounds } from "@/lib/drift/scenery";

// Harbor's ground: the race track's grass as an island, the sea all around it.

const U = M_TO_UNIT;
const SEA = "#3f8fd6";
const SAND = "#e8d9a8";

export default function HarborGround({ track }: { track: Track }) {
  const { x, z, r } = useMemo(() => {
    const b = bounds(track);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const half = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    return { x: cx, z: cz, r: half + 70 };
  }, [track]);
  return (
    <group>
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8000, 8000]} />
        <meshStandardMaterial color={SEA} roughness={0.4} />
      </mesh>
      <mesh position={[x * U, -0.45, z * U]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[(r + 6) * U, 96]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
      <mesh position={[x * U, -0.3, z * U]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * U, 96]} />
        <meshStandardMaterial color={GRASS} roughness={1} />
      </mesh>
    </group>
  );
}
