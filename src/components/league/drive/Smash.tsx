"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Howl } from "howler";
import { SMASH, type SmashHit, type SmashStore } from "@/lib/league-city/smash";
import { BLAST_ROWS, REBUILD_REACH, REBUILD_SPEED, toFootprint } from "@/lib/league-city/smash-net";
import type { ClientMsg } from "@/lib/league-city/drive/net";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { CarApi } from "./Car";
import { Bursts, type VoxelBursts } from "./Voxels";

// Your car against the town's buildings (lib/league-city/smash), every one
// but yours: every frame at speed, the columns under the car lose their
// bottom floor, with a burst of wall and window cubes, a shake and a thud.
// Your blasts (bombs, missiles, shockwaves) go through `blast`. Hits show at
// once and go to the drive room, which has the last word (DriveWorld applies
// its `damage`); someone else's hits come back through `debris`. Signed out
// you can't break anything: running into a building shows the sign-in hint,
// and a shielded one (it fell less than 12h ago) says how long it has left.
// Parked against your own broken building, the HUD counts it back up.

/** What the room said about you: signed in with a building (you smash), or not (yet). */
export type SmashSide = "smash" | "none";

export interface SmashApi {
  /** A blast at (x, z) meters with `reach` meters; `fx` is the attack (yours or not). */
  blast: (x: number, z: number, reach: number, fx?: { id: number; mine: boolean }) => void;
  /** Floors someone else knocked off a column: the same burst yours make. */
  debris: (target: number, col: number) => void;
}

const DEBRIS = ["#1c2233", "#2a3147", "#ffd76a", "#ffe9a8", "#8fa3c7", "#3a4462"];
const CHUNK = ["#141a2a"];
/** How much of a blast's reach breaks floors. */
const BLAST_REACH = 0.7;
/** Running into a building you can't break: the hint shows at most this often (ms). */
const HINT_EVERY_MS = 8000;

interface Props {
  store: SmashStore;
  car: React.MutableRefObject<CarApi | null>;
  impactRef: React.MutableRefObject<{ strength: number; at: number }>;
  muted: boolean;
  /** What the room said about you. */
  sideRef: React.MutableRefObject<SmashSide>;
  send: (msg: ClientMsg) => void;
  /** Your login (lowercase), for your own building. */
  me: string;
  telemetryRef: React.MutableRefObject<DriveTelemetry>;
}

export default forwardRef<SmashApi, Props>(function Smash({ store, car, impactRef, muted, sideRef, send, me, telemetryRef }, ref) {
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

  const burst = (x: number, y: number, z: number, floorH: number, power: number) => {
    // The floor itself flies off as a big block, with bits of wall and window.
    bursts.current?.burst(x, y, z, { count: 1, speed: 22, colors: CHUNK, size: floorH * 0.85, life: 1.6, gravity: 60 });
    bursts.current?.burst(x, y, z, { count: 8 + power * 5, speed: 24 + power * 10, colors: DEBRIS, size: Math.min(2.2, floorH * 0.3), life: 1.1 });
  };

  const show = (hits: SmashHit[], power: number) => {
    let down = false;
    for (const h of hits) {
      const t = store.targets[h.target];
      burst(h.x, h.y, h.z, t.floorH, power);
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

  /** One `smash` per building hit. */
  const report = (hits: SmashHit[], k: "car" | "blast", fx?: number) => {
    const byTarget = new Map<number, number[]>();
    for (const h of hits) byTarget.set(h.target, [...(byTarget.get(h.target) ?? []), h.col]);
    for (const [target, c] of byTarget) send({ t: "smash", b: store.targets[target].login, c, k, ...(fx !== undefined ? { fx } : {}) });
  };

  useImperativeHandle(ref, () => ({
    blast(x, z, reach, fx) {
      // Only your own attacks break floors from here; others' come back from the room.
      if (!fx?.mine || sideRef.current !== "smash") return;
      const hits = store.hitCircle(x * M_TO_UNIT, z * M_TO_UNIT, reach * BLAST_REACH * M_TO_UNIT, BLAST_ROWS, Date.now(), 0, undefined, me);
      show(hits, 2);
      report(hits, "blast", fx.id);
    },
    debris(target, col) {
      const t = store.targets[target];
      const [x, z] = store.columnCenter(target, col);
      burst(x, t.floorH / 2, z, t.floorH, 0);
    },
  }));

  const lastHint = useRef(0);
  useFrame(() => {
    const c = car.current;
    const tele = telemetryRef.current;
    if (!c) return;
    const p = c.body.translation();
    const x = p.x * M_TO_UNIT;
    const z = p.z * M_TO_UNIT;
    const speed = Math.abs(c.state.speed);

    // Parked against your own broken building: the room builds it back; the HUD counts.
    const mine = store.index.get(me);
    if (mine !== undefined && store.isDamaged(mine) && speed < REBUILD_SPEED && toFootprint(store, mine, x, z) <= REBUILD_REACH) {
      tele.rebuildFloors = store.standing(mine);
      tele.rebuildOf = store.targets[mine].floors * store.rowsOf(mine).length;
    } else tele.rebuildOf = 0;

    // Signed out the buildings are solid and running into one shows the hint;
    // signed in, a shielded one says how long it has left.
    const now = performance.now();
    if (speed > 2 && now - lastHint.current > HINT_EVERY_MS) {
      const epoch = Date.now();
      for (let i = 0; i < store.targets.length; i++) {
        if (store.targets[i].login === me || toFootprint(store, i, x, z) > SMASH.carRadius) continue;
        if (sideRef.current === "none") tele.sideHintAt = now;
        else if (store.isShielded(i, epoch)) {
          tele.shieldHintAt = now;
          tele.shieldHours = Math.ceil((store.shieldUntil[i] - epoch) / 3_600_000);
        } else continue;
        lastHint.current = now;
        break;
      }
    }
    if (sideRef.current !== "smash" || speed < SMASH.minSpeed) return;
    const n = c.state.boosting ? SMASH.boostRows : SMASH.rows;
    const hits = store.hitCircle(x, z, SMASH.carRadius, n, Date.now(), SMASH.cooldownMs, undefined, me);
    if (!hits.length) return;
    show(hits, c.state.boosting ? 1 : 0);
    report(hits, "car");
  });

  return <Bursts ref={bursts} />;
});
