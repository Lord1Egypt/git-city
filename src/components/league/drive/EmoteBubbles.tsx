"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { EMOTES, EMOTE_MIN_MS, EMOTE_MS } from "@/lib/league-city/drive/emotes";
import { INTERP_MS, emptySnapshot, type ClientMsg } from "@/lib/league-city/drive/net";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { CarApi } from "./Car";
import type { RemoteDriver } from "./useDrivePresence";

// Quick reactions (lib drive/emotes) as bubbles over the cars: yours the
// moment you press the key, everyone else's when the room forwards it. One
// bubble per car; a new one replaces the old.

export interface EmoteApi {
  /** Pop reaction slot `e` over your car and tell the room. */
  send: (e: number) => void;
}

/** One line of the HUD's reaction log. */
export interface EmoteLogEntry {
  key: number;
  name: string;
  e: number;
  mine: boolean;
}

interface Bubble {
  key: number;
  /** "me" or a driver id. */
  who: string;
  e: number;
}

/** Over the name tag (RemoteCars draws it at 7.5); yours, with no tag, just over the roof. */
const LIFT = 9.5;
const SELF_LIFT = 5;

function EmoteBubble({ bubble, carRef, remotes }: { bubble: Bubble; carRef: React.MutableRefObject<CarApi | null>; remotes: React.MutableRefObject<Map<string, RemoteDriver>> }) {
  const group = useRef<THREE.Group>(null);
  const snap = useRef(emptySnapshot());
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (bubble.who === "me") {
      const c = carRef.current;
      if (c) g.position.set(c.group.position.x, c.group.position.y + SELF_LIFT, c.group.position.z);
      return;
    }
    const s = remotes.current.get(bubble.who)?.buffer.sample(performance.now() - INTERP_MS, snap.current);
    if (s) g.position.set(s.x * M_TO_UNIT, s.y * M_TO_UNIT + LIFT, s.z * M_TO_UNIT);
  });
  return (
    <group ref={group}>
      <Html center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="border-[3px] border-border bg-bg/85 px-1.5 py-0.5 text-[26px] leading-none"
          style={{ animation: `emote-pop ${EMOTE_MS}ms ease-out both` }}
          aria-hidden
        >
          {EMOTES[bubble.e]}
        </div>
      </Html>
    </group>
  );
}

export default function EmoteBubbles({
  carRef,
  remotes,
  send,
  apiRef,
  sinkRef,
  name,
  onLog,
}: {
  carRef: React.MutableRefObject<CarApi | null>;
  remotes: React.MutableRefObject<Map<string, RemoteDriver>>;
  send: (msg: ClientMsg) => void;
  apiRef: React.MutableRefObject<EmoteApi | null>;
  /** The drive room's emote messages land here. */
  sinkRef: React.MutableRefObject<(from: string, e: number) => void>;
  /** Your name in the room, for the log. */
  name: string;
  /** Every reaction, yours too, for the HUD's log. */
  onLog?: (entry: EmoteLogEntry) => void;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const seq = useRef(0);
  const last = useRef(0);
  // DriveWorld hands a new `send` every render; the timers must outlive those.
  const sendRef = useRef(send);
  const logRef = useRef({ name, onLog });
  useEffect(() => {
    sendRef.current = send;
    logRef.current = { name, onLog };
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const pop = (who: string, e: number) => {
      const key = ++seq.current;
      setBubbles((list) => [...list.filter((b) => b.who !== who), { key, who, e }]);
      const { name: me, onLog: log } = logRef.current;
      const n = who === "me" ? me : remotes.current.get(who)?.name;
      if (n) log?.({ key, name: n, e, mine: who === "me" });
      const t = setTimeout(() => {
        timers.delete(t);
        setBubbles((list) => list.filter((b) => b.key !== key));
      }, EMOTE_MS);
      timers.add(t);
    };
    apiRef.current = {
      send: (e) => {
        const now = performance.now();
        if (now - last.current < EMOTE_MIN_MS || !EMOTES[e]) return;
        last.current = now;
        sendRef.current({ t: "emote", e });
        pop("me", e);
      },
    };
    sinkRef.current = pop;
    return () => {
      apiRef.current = null;
      sinkRef.current = () => {};
      for (const t of timers) clearTimeout(t);
    };
  }, [apiRef, sinkRef, remotes]);

  return (
    <>
      {bubbles.map((b) => (
        <EmoteBubble key={b.key} bubble={b} carRef={carRef} remotes={remotes} />
      ))}
    </>
  );
}
