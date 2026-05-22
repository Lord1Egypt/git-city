"use client";

import { useEffect, useState, useMemo } from "react";
import type { RemotePilot, SelfPvpState, KillFeedEntry } from "@/lib/useFlyPresence";
import { getHappyHourStatus, formatCountdown } from "@/lib/happyHour";

// All visual elements here follow the city pattern:
//   border-[3px] border-border bg-bg/70 backdrop-blur-sm
// No glow, no lime-as-background, no isolated cards. Lime is only an
// accent for "happy hour" highlights (it's a special event) and for the
// hit-marker confirmation flash.

export interface SelfPosLike { x: number; z: number; }

const CREAM_DARK = "#c8b89c";
const MUTED = "#8c8c9c";
const LIME = "#c8e64a";
const DAMAGE = "#d44";

interface PvPHudProps {
  selfStateRef: React.MutableRefObject<SelfPvpState>;
  pilotsRef: React.MutableRefObject<Map<string, RemotePilot>>;
  pvpEnabled: boolean;
  /** Toggling is owned by the central status card now; kept for compatibility. */
  onTogglePvp: (enabled: boolean) => void;
  selfPosRef?: React.MutableRefObject<SelfPosLike>;
  selfYawRef?: React.MutableRefObject<number>;
}

interface Snapshot {
  lastAttackerId: string | null;
  lastAttackerAt: number;
  attackerLogin: string | null;
  attackerX: number;
  attackerZ: number;
  lastHitConfirmedAt: number;
  lastDamageAt: number;
  downedUntil: number;
  killFeed: KillFeedEntry[];
  now: number;
  selfX: number;
  selfZ: number;
  selfYaw: number;
}

function emptySnapshot(): Snapshot {
  return {
    lastAttackerId: null,
    lastAttackerAt: 0,
    attackerLogin: null,
    attackerX: 0,
    attackerZ: 0,
    lastHitConfirmedAt: 0,
    lastDamageAt: 0,
    downedUntil: 0,
    killFeed: [],
    now: Date.now(),
    selfX: 0,
    selfZ: 0,
    selfYaw: 0,
  };
}

export default function PvPHud({
  selfStateRef,
  pilotsRef,
  pvpEnabled,
  selfPosRef,
  selfYawRef,
}: PvPHudProps) {
  const [snap, setSnap] = useState<Snapshot>(emptySnapshot);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = selfStateRef.current;
      const attacker = s.lastAttackerId ? pilotsRef.current.get(s.lastAttackerId) : null;
      setSnap({
        lastAttackerId: s.lastAttackerId,
        lastAttackerAt: s.lastAttackerAt,
        attackerLogin: attacker ? attacker.login : null,
        attackerX: s.lastAttackerX,
        attackerZ: s.lastAttackerZ,
        lastHitConfirmedAt: s.lastHitConfirmedAt,
        lastDamageAt: s.lastDamageAt,
        downedUntil: s.downedUntil,
        killFeed: s.killFeed,
        now: Date.now(),
        selfX: selfPosRef?.current.x ?? 0,
        selfZ: selfPosRef?.current.z ?? 0,
        selfYaw: selfYawRef?.current ?? 0,
      });
    }, 60);
    return () => clearInterval(interval);
  }, [selfStateRef, pilotsRef, selfPosRef, selfYawRef]);

  const happyHour = useMemo(() => getHappyHourStatus(new Date(snap.now)), [snap.now]);
  const isDowned = snap.downedUntil > snap.now;

  const hitMarkerAge = snap.now - snap.lastHitConfirmedAt;
  const showHitMarker = snap.lastHitConfirmedAt > 0 && hitMarkerAge < 250;
  const hitMarkerOpacity = showHitMarker ? Math.max(0, 1 - hitMarkerAge / 250) : 0;

  const damageAge = snap.now - snap.lastDamageAt;
  const showDamageFlash = snap.lastDamageAt > 0 && damageAge < 200;
  const damageFlashOpacity = showDamageFlash ? Math.max(0, 1 - damageAge / 200) : 0;

  const showDamageDir = snap.lastDamageAt > 0 && damageAge < 3_000;
  const dirOpacity = showDamageDir ? Math.max(0, 1 - damageAge / 3_000) : 0;
  let damageDirAngleDeg = 0;
  if (showDamageDir) {
    const dx = snap.attackerX - snap.selfX;
    const dz = snap.attackerZ - snap.selfZ;
    const worldAngle = Math.atan2(dx, -dz);
    const screenAngle = worldAngle - snap.selfYaw;
    damageDirAngleDeg = (screenAngle * 180) / Math.PI;
  }

  const visibleKillFeed = snap.killFeed.filter((e) => snap.now - e.at < 6_000);

  return (
    <>
      {/* ─── Happy Hour banner — top center, BELOW the unified status
          card (which sits at top-4 with ~40px height). Same `border-[3px]
          border-border bg-bg/70 backdrop-blur-sm` template as every other
          panel in the city. Lime only appears on the "2× XP" highlight. ── */}
      {happyHour.active && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 transform"
          style={{ top: 72 }}
        >
          <div className="inline-flex items-center gap-2 border-[3px] border-border bg-bg/70 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-[10px]">🔥</span>
            <span className="text-[10px] uppercase text-cream tracking-wider">Force Push Happy Hour</span>
            <span className="mx-1 text-border">|</span>
            <span className="text-[10px] uppercase font-bold" style={{ color: LIME, letterSpacing: "0.05em" }}>
              2× XP
            </span>
            <span className="mx-1 text-border">|</span>
            <span className="text-[10px]" style={{ color: LIME }}>
              {formatCountdown(happyHour.endsInMs)}
            </span>
          </div>
        </div>
      )}

      {/* ─── Killfeed — plain text in the top-right corner ──
          No cards, no borders — fading text only, like Overwatch / CoD. */}
      {visibleKillFeed.length > 0 && (
        <div
          className="pointer-events-none fixed z-50 text-right"
          style={{
            top: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "flex-end",
            fontFamily: "Silkscreen, monospace",
            maxWidth: 320,
          }}
        >
          {visibleKillFeed.map((e) => {
            const age = snap.now - e.at;
            const opacity = age < 4_000 ? 1 : Math.max(0, 1 - (age - 4_000) / 2_000);
            return (
              <div
                key={e.id}
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: CREAM_DARK,
                  opacity,
                  textShadow: "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000",
                  whiteSpace: "nowrap",
                }}
              >
                {e.happyHour && <span style={{ marginRight: 4 }}>🔥</span>}
                <span style={{ color: e.killerWasSelf ? LIME : CREAM_DARK }}>
                  {e.killerWasSelf ? "you" : `@${e.killerLogin}`}
                </span>
                <span style={{ color: MUTED, margin: "0 6px" }}>→</span>
                <span style={{ color: e.victimWasSelf ? DAMAGE : CREAM_DARK }}>
                  {e.victimWasSelf ? "you" : `@${e.victimLogin}`}
                </span>
                {e.killerWasSelf && (
                  <span style={{ color: LIME, marginLeft: 8 }}>
                    +{e.happyHour ? 10 : 5} XP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Center: hit marker (X flash on confirmed hit) ─── */}
      {showHitMarker && pvpEnabled && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 transform"
          style={{ width: 28, height: 28, opacity: hitMarkerOpacity }}
        >
          <div style={{ position: "absolute", left: 4, top: 4, width: 20, height: 3, background: LIME, transform: "rotate(45deg)", transformOrigin: "center" }} />
          <div style={{ position: "absolute", left: 4, top: 4, width: 20, height: 3, background: LIME, transform: "rotate(-45deg)", transformOrigin: "center", marginTop: 18 }} />
        </div>
      )}

      {/* ─── Damage vignette pulse on incoming damage ─── */}
      {showDamageFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-[55]"
          style={{
            opacity: damageFlashOpacity,
            boxShadow: `inset 0 0 120px 40px ${DAMAGE}`,
          }}
        />
      )}

      {/* ─── Damage direction indicator (arrow at screen edge) ─ */}
      {showDamageDir && (selfPosRef || selfYawRef) && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-50"
          style={{
            transform: `translate(-50%, -50%) rotate(${damageDirAngleDeg}deg)`,
            width: 6,
            height: 220,
            opacity: dirOpacity,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderBottom: `16px solid ${DAMAGE}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 16,
              transform: "translateX(-50%)",
              width: 4,
              height: 60,
              background: DAMAGE,
            }}
          />
        </div>
      )}

      {/* ─── "Shot by @user" callout below the central status card ── */}
      {snap.attackerLogin && snap.lastAttackerAt > 0 && snap.now - snap.lastAttackerAt < 5_000 && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 transform"
          style={{ top: happyHour.active ? 108 : 72 }}
        >
          <div className="inline-flex items-center gap-2 border-[3px] bg-bg/70 px-3 py-1 backdrop-blur-sm"
               style={{ borderColor: DAMAGE }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: DAMAGE }}>
              shot by @{snap.attackerLogin}
            </span>
          </div>
        </div>
      )}

      {/* ─── BUILD FAILED overlay on death ───── */}
      {isDowned && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div className="border-[3px] bg-bg/80 px-8 py-6 text-center backdrop-blur-sm"
               style={{ borderColor: DAMAGE }}>
            <div
              style={{
                fontFamily: "Silkscreen, monospace",
                color: DAMAGE,
                fontSize: 36,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Build Failed
            </div>
            <div className="mt-2 text-[10px] uppercase text-muted tracking-wider">
              Respawning in 5s
            </div>
          </div>
        </div>
      )}
    </>
  );
}
