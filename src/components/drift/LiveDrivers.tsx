"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CarApi } from "@/components/league/drive/Car";
import CarModel from "@/components/league/drive/CarModel";
import type { DriveInputRef } from "@/components/league/drive/useDriveInput";
import { useDrivePresence, type RemoteDriver } from "@/components/league/drive/useDrivePresence";
import { NameTag, fadeNear, useSeeThrough } from "@/components/race/Ghost";
import { INTERP_MS, emptySnapshot } from "@/lib/league-city/drive/net";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";

// Everyone else on this spot right now, as see-through cars with their name
// over them (party/drift.ts). Nothing to hit: a drift run is yours alone.
// Lives outside DriftWorld, so a restart doesn't drop you from the room.

/** The horn never goes out from here: nobody hears a ghost. */
const QUIET: React.MutableRefObject<DriveInputRef> = {
  current: {
    input: { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false, horn: false, camera: false, reset: false, fire: false },
    pressed: { camera: false, reset: false, horn: false, fire: false },
  },
};
const noop = () => {};

function LiveGhost({ remote, show, near }: { remote: RemoteDriver; show: () => boolean; near: () => { x: number; z: number } | null }) {
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Object3D | null)[]>([]);
  const snap = useRef(emptySnapshot());
  useSeeThrough(group);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = show() ? remote.buffer.sample(performance.now() - INTERP_MS, snap.current) : null;
    g.visible = !!s;
    if (!s) return;
    g.position.set(s.x * M_TO_UNIT, s.y * M_TO_UNIT, s.z * M_TO_UNIT);
    g.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    fadeNear(g, near());
  });

  const label = remote.name.startsWith("guest-") ? "guest" : `@${remote.name}`;
  return (
    <group ref={group} visible={false}>
      <CarModel color={remote.color} wheelRefs={wheels} />
      <NameTag text={label} color={remote.color} />
    </group>
  );
}

export default function LiveDrivers({
  room,
  name,
  car,
  show,
}: {
  /** The spot's id. */
  room: string;
  name: string;
  /** Your car, written by DriftWorld (null between runs). */
  car: React.MutableRefObject<CarApi | null>;
  show: boolean;
}) {
  const { remotes, drivers } = useDrivePresence({ slug: room, name, car, input: QUIET, onBump: noop, onBattle: noop, party: "drift" });
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  }, [show]);
  const visible = useCallback(() => showRef.current, []);
  const near = useCallback(() => {
    const g = car.current?.group;
    return g ? { x: g.position.x, z: g.position.z } : null;
  }, [car]);

  return (
    <>
      {drivers.map((d) => {
        const r = remotes.current.get(d.id);
        return r ? <LiveGhost key={d.id} remote={r} show={visible} near={near} /> : null;
      })}
    </>
  );
}
