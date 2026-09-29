"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { SmashStore } from "@/lib/league-city/smash";
import { Flag } from "./identity/IdentityPieces";
import { useFontReady, useLogo } from "./identity/IdentityLayer";
import { wideTexture } from "./identity/logoTexture";

// Smash: the attacker's flag, planted in each building lying in rubble. The
// town's own flag piece (pole, gold ball, waving cloth), its cloth the GitHub
// avatar and @login of whoever took the last floor (they may come from any
// town, or none).
// Re-reads the store only when its version moves (a building falls or heals).

interface Planted {
  key: string;
  x: number;
  z: number;
  by: string;
}

/** The cloth at the wide panel's 2:1, so the logo and the name both fit. */
const CLOTH: [number, number] = [22, 11];
/** Lower than the town's own flags: it stands in rubble, in view of the car. */
const POLE = 18;

/** A GitHub avatar by login (CORS-open, so it can go on a canvas). */
const avatarOf = (login: string) => `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=128`;

function Planted({ flag, phase }: { flag: Planted; phase: number }) {
  const logo = useLogo(avatarOf(flag.by));
  const fontReady = useFontReady();
  // fontReady: redraw once Silkscreen is in.
  const tex = useMemo(() => wideTexture(logo, `@${flag.by}`), [logo, flag.by, fontReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  return <Flag position={[flag.x, flag.z]} rot={0} map={tex} phase={phase} cloth={CLOTH} height={POLE} />;
}

export default function RubbleFlags({ store }: { store: SmashStore }) {
  const [flags, setFlags] = useState<Planted[]>([]);
  const seen = useRef(-1);
  useFrame(() => {
    if (store.version === seen.current) return;
    seen.current = store.version;
    const next: Planted[] = [];
    for (const [i, by] of store.demolishedBy) {
      const t = store.targets[i];
      // Off the lot's center, so the cloth flies over the rubble, not inside it.
      next.push({ key: t.login, x: t.x - t.w * 0.3, z: t.z, by });
    }
    setFlags(next);
  });
  return (
    <>
      {flags.map((f, i) => (
        <Planted key={`${f.key}:${f.by}`} flag={f} phase={i * 0.9} />
      ))}
    </>
  );
}
