"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { SmashStore } from "@/lib/league-city/smash";

// Rivalry smash: over each building lying in rubble, who took its last floor.
// Re-reads the store only when its version moves (a building falls or heals).
// A few times a second each label hides while a standing building is between
// it and the camera (a ray against the town's building boxes), so it never
// reads as the name of the tower in front of it.

interface Label {
  key: string;
  x: number;
  y: number;
  z: number;
  by: string;
}

const CHECK_MS = 250;

/** Does the segment from (ox, oy, oz) to (tx, ty, tz) cross the box? (slab test, t in (0, 1)) */
function crosses(o: number[], d: number[], min: number[], max: number[]): boolean {
  let t0 = 0.001;
  let t1 = 0.999;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < min[a] || o[a] > max[a]) return false;
      continue;
    }
    let n = (min[a] - o[a]) / d[a];
    let f = (max[a] - o[a]) / d[a];
    if (n > f) [n, f] = [f, n];
    t0 = Math.max(t0, n);
    t1 = Math.min(t1, f);
    if (t0 > t1) return false;
  }
  return true;
}

export default function RubbleLabels({ store, color }: { store: SmashStore; color: string }) {
  const [labels, setLabels] = useState<Label[]>([]);
  const seen = useRef(-1);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const lastCheck = useRef(0);

  useFrame(({ camera }) => {
    if (store.version !== seen.current) {
      seen.current = store.version;
      const next: Label[] = [];
      for (const [i, by] of store.demolishedBy) {
        const t = store.targets[i];
        next.push({ key: t.login, x: t.x, y: t.floorH * 1.4, z: t.z, by });
      }
      setLabels(next);
    }
    const now = performance.now();
    if (now - lastCheck.current < CHECK_MS || labels.length === 0) return;
    lastCheck.current = now;
    const o = [camera.position.x, camera.position.y, camera.position.z];
    for (const l of labels) {
      const node = nodes.current.get(l.key);
      if (!node) continue;
      const d = [l.x - o[0], l.y - o[1], l.z - o[2]];
      let hidden = false;
      for (let i = 0; i < store.targets.length && !hidden; i++) {
        const t = store.targets[i];
        if (t.login === l.key || store.isBroken(i)) continue;
        hidden = crosses(o, d, [t.x - t.w / 2, 0, t.z - t.d / 2], [t.x + t.w / 2, t.floors * t.floorH, t.z + t.d / 2]);
      }
      node.style.visibility = hidden ? "hidden" : "visible";
    }
  });

  return (
    <>
      {labels.map((l) => (
        <Html key={l.key} position={[l.x, l.y, l.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={(el) => {
              if (el) nodes.current.set(l.key, el);
              else nodes.current.delete(l.key);
            }}
            className="whitespace-nowrap border-2 bg-bg/85 px-1.5 py-0.5 font-pixel text-[9px] uppercase text-cream"
            style={{ borderColor: color }}
          >
            Knocked down by <span style={{ color }}>@{l.by}</span>
          </div>
        </Html>
      ))}
    </>
  );
}
