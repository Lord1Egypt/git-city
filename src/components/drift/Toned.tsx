"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Brings a drift track into a scene lit far hotter than the spots'
// afternoon: a town's night lights everything about six times over (strong
// ambient, exposure 1.65) because its buildings are near-black, so the
// track's whites and the Kenney models blow out to a flat mint. Scaling the
// colors down only trades that for black asphalt; here every color (texture
// and vertex colors included) is squeezed in the shader to `tone` × √color,
// which pulls whites down to a mid grey and keeps the darks readable, and
// the glow goes down with it. Each lit, opaque material is swapped for a
// patched copy the first time it shows up (models stream in late), so the
// originals, shared with other scenes, stay as they are. Unlit ones (the
// gantry's lamps and banner) and the ones a part fades itself (the gantry)
// are left alone: their owners keep changing them.

const SCAN_EVERY = 0.5;

export default function Toned({ tone, children }: { tone: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const copies = useRef(new Map<THREE.Material, THREE.Material>());
  // The first look waits a moment, so a part that fades itself has made its materials transparent.
  const last = useRef(0);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || tone === 1 || clock.elapsedTime - last.current < SCAN_EVERY) return;
    last.current = clock.elapsedTime;
    const made = new Set(copies.current.values());
    const swap = (m: THREE.Material) => {
      if (made.has(m) || m.transparent || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
      let c = copies.current.get(m);
      if (!c) {
        const copy = m.clone();
        const before = m.onBeforeCompile.bind(m);
        const key = m.customProgramCacheKey.bind(m);
        copy.onBeforeCompile = (shader, renderer) => {
          before(shader, renderer);
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <color_fragment>", `#include <color_fragment>\n diffuseColor.rgb = ${tone.toFixed(3)} * sqrt(max(diffuseColor.rgb, vec3(0.0)));`)
            .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n totalEmissiveRadiance *= ${tone.toFixed(3)};`);
        };
        copy.customProgramCacheKey = () => `${key()}|toned-${tone}`;
        c = copy;
        copies.current.set(m, c);
        made.add(c);
      }
      return c;
    };
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  });
  useEffect(() => {
    const map = copies.current;
    return () => {
      map.forEach((c) => c.dispose());
      map.clear();
    };
  }, []);
  return <group ref={group}>{children}</group>;
}
