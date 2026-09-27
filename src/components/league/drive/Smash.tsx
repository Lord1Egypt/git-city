"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Howl } from "howler";
import { SMASH, type SmashHit, type SmashStore } from "@/lib/league-city/smash";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { CarApi } from "./Car";
import { Bursts, type VoxelBursts } from "./Voxels";

// Your car against the rival town's buildings (lib/league-city/smash): every
// frame at speed, the columns under the car lose their bottom floor, with a
// burst of wall and window cubes, a shake and a thud. Blasts (bombs,
// missiles, shockwaves) go through `blast`. The building renderer draws what
// is left from the same store.

export interface SmashApi {
  /** A blast at (x, z) meters with `reach` meters. */
  blast: (x: number, z: number, reach: number) => void;
}

const CHUNK = ["#141a2a"];
const DEBRIS = ["#1c2233", "#2a3147", "#ffd76a", "#ffe9a8", "#8fa3c7", "#3a4462"];
/** Floors a blast takes from each column it reaches, and how much of its reach counts. */
const BLAST_ROWS = 3;
const BLAST_REACH = 0.7;

interface Props {
  store: SmashStore;
  car: React.MutableRefObject<CarApi | null>;
  impactRef: React.MutableRefObject<{ strength: number; at: number }>;
  muted: boolean;
}

export default forwardRef<SmashApi, Props>(function Smash({ store, car, impactRef, muted }, ref) {
  const bursts = useRef<VoxelBursts | null>(null);
  const crash = useRef<Howl | null>(null);
  const silent = useRef(muted);
  useEffect(() => {
    silent.current = muted;
  }, [muted]);
  useEffect(() => {
    crash.current = new Howl({ src: ["/sounds/drive/impact.ogg"], volume: 0.9 });
    return () => {
      crash.current?.unload();
      crash.current = null;
    };
  }, []);

  const show = (hits: SmashHit[], power: number) => {
    let down = false;
    for (const h of hits) {
      const t = store.targets[h.target];
      // The floor itself flies off as a big block, with bits of wall and window.
      bursts.current?.burst(h.x, h.y, h.z, { count: 1, speed: 22, colors: CHUNK, size: t.floorH * 0.85, life: 1.6, gravity: 60 });
      bursts.current?.burst(h.x, h.y, h.z, { count: 8 + power * 5, speed: 24 + power * 10, colors: DEBRIS, size: Math.min(2.2, t.floorH * 0.3), life: 1.1 });
      if (h.down) {
        down = true;
        bursts.current?.burst(t.x, t.floorH, t.z, { count: 80, speed: 45, colors: DEBRIS, size: 2.4, life: 1.6 });
      }
    }
    if (!hits.length) return;
    const strength = down ? 1 : Math.min(0.8, 0.3 + hits.length * 0.08 + power * 0.15);
    impactRef.current = { strength, at: performance.now() };
    if (down && crash.current && !silent.current) {
      crash.current.rate(0.7);
      crash.current.play();
    }
  };

  useImperativeHandle(ref, () => ({
    blast(x, z, reach) {
      show(store.hitCircle(x * M_TO_UNIT, z * M_TO_UNIT, reach * BLAST_REACH * M_TO_UNIT, BLAST_ROWS, performance.now()), 2);
    },
  }));

  useFrame(() => {
    const c = car.current;
    if (!c) return;
    if (Math.abs(c.state.speed) < SMASH.minSpeed) return;
    const p = c.body.translation();
    const n = c.state.boosting ? SMASH.boostRows : SMASH.rows;
    const hits = store.hitCircle(p.x * M_TO_UNIT, p.z * M_TO_UNIT, SMASH.carRadius, n, performance.now(), SMASH.cooldownMs);
    show(hits, c.state.boosting ? 1 : 0);
  });

  return <Bursts ref={bursts} />;
});
