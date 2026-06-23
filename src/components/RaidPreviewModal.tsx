"use client";

import "@/lib/silenceThreeClockWarning";
import { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { RaidPreviewResponse, RaidBoostItem } from "@/lib/raid";
import { VehicleMesh } from "@/components/RaidSequence3D";

interface Props {
  preview: RaidPreviewResponse;
  loading: boolean;
  error: string | null;
  onRaid: (boostPurchaseId?: number, vehicleId?: string) => void;
  onCancel: () => void;
}

const ESTIMATE_CONFIG = {
  weak: { label: "WEAK", color: "#ff4444", bars: 1 },
  medium: { label: "MEDIUM", color: "#ffaa22", bars: 2 },
  strong: { label: "STRONG", color: "#44ff44", bars: 3 },
} as const;

// Role accent — "you" reads as the app's lime accent, the enemy as combat red.
const ROLE_ACCENT = {
  attack: "#c8e64a",
  defense: "#ef4444",
} as const;

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-bg-card px-1 py-1.5 text-center">
      <div className="text-[11px] font-bold tabular-nums text-cream">{value}</div>
      <div className="mt-0.5 text-[7px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

/**
 * Fighter card for the VS matchup. The attacker (`hidden = false`) shows the
 * exact score and a stat breakdown grid. The defender (`hidden = true`) shows
 * only the qualitative estimate (WEAK/MEDIUM/STRONG) with the breakdown cells
 * locked to "?" — enough to scout the difficulty, but exact power stays a
 * surprise until the battle resolves.
 */
function FighterCard({
  avatar,
  login,
  role,
  estimate,
  score,
  breakdown,
  hidden = false,
}: {
  avatar: string | null;
  login: string;
  role: "attack" | "defense";
  estimate: "weak" | "medium" | "strong";
  score: number;
  breakdown: { commits: number; streak: number; kudos: number };
  hidden?: boolean;
}) {
  const config = ESTIMATE_CONFIG[estimate];
  const accent = ROLE_ACCENT[role];
  return (
    <div className="flex flex-col overflow-hidden border-2 border-border bg-bg-card/50">
      <div className="h-[3px] w-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-1 flex-col items-center gap-2 p-3">
        {/* Identity */}
        <span
          className="shrink-0 border-2 p-0.5"
          style={{ borderColor: `${accent}66`, backgroundColor: `${accent}14` }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="block h-9 w-9"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <span className="block h-9 w-9 bg-border" />
          )}
        </span>
        <p className="max-w-full truncate text-xs font-bold text-cream">{login}</p>

        {/* Role + strength */}
        <span className="text-[9px] uppercase tracking-wider text-muted">
          {role === "attack" ? "Attack" : "Defense"}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-4 w-3.5"
              style={{
                backgroundColor: i <= config.bars ? config.color : "#2a2a30",
                opacity: i <= config.bars ? 1 : 0.4,
              }}
            />
          ))}
        </div>
        {hidden ? (
          <span className="text-xl font-bold tracking-wider" style={{ color: config.color }}>
            {config.label}
          </span>
        ) : (
          <span
            className="text-2xl font-bold leading-none tabular-nums"
            style={{ color: config.color }}
          >
            {score}
          </span>
        )}

        {/* Stat breakdown grid */}
        <div className="grid w-full grid-cols-3 gap-px border border-border/50 bg-border/30">
          {hidden ? (
            <>
              <StatCell label="Commits" value="?" />
              <StatCell label="Streak" value="?" />
              <StatCell label="Kudos" value="?" />
            </>
          ) : (
            <>
              <StatCell label="Commits" value={breakdown.commits} />
              <StatCell label="Streak" value={breakdown.streak} />
              <StatCell label="Kudos" value={breakdown.kudos} />
            </>
          )}
        </div>

        {hidden && (
          <span className="text-[7px] uppercase tracking-wider text-dim">power hidden</span>
        )}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M8 1 L2 7 L8 13" : "M2 1 L8 7 L2 13"}
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function SpinningVehicle({ type }: { type: string }) {
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.8;
  });
  return (
    <group ref={groupRef}>
      <VehicleMesh type={type} />
    </group>
  );
}

export default function RaidPreviewModal({ preview, loading, error, onRaid, onCancel }: Props) {
  const [selectedBoost, setSelectedBoost] = useState<RaidBoostItem | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState(preview.vehicle);

  const vehicles = preview.available_vehicles;
  const currentIndex = Math.max(
    0,
    vehicles.findIndex((v) => v.item_id === selectedVehicle),
  );
  const selectedVehicleName = vehicles[currentIndex]?.name ?? selectedVehicle;
  const cycleVehicle = (dir: number) => {
    if (vehicles.length < 2) return;
    const next = (currentIndex + dir + vehicles.length) % vehicles.length;
    setSelectedVehicle(vehicles[next].item_id);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="pixel-shadow mx-4 flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto border-[3px] border-red-500/50 bg-bg-raised/95 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — red combat gradient + pixel grid overlay */}
        <div
          className="relative shrink-0 overflow-hidden border-b-2 border-red-500/20 px-5 pb-3 pt-4 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.04) 55%, transparent 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "8px 8px",
            }}
          />
          <div className="relative">
            {preview.special_event === "friday13" && (
              <p className="mb-1 animate-pulse font-silkscreen text-[10px] uppercase tracking-wider text-orange-400">
                Friday the 13th - Unlimited Battles
              </p>
            )}
            <h2 className="font-silkscreen text-sm uppercase tracking-wider text-red-400">
              Battle Preview
            </h2>
            <p className="mt-1 text-[10px] text-muted">
              {preview.special_event === "friday13"
                ? `${preview.raids_today} battles today - NO LIMITS`
                : `${preview.raids_today}/${preview.raids_max} battles used today`}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Vehicle — 3D carousel selector */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Vehicle</p>
            <div className="relative h-36 w-full overflow-hidden border border-cream/10 bg-black/40">
              <Canvas camera={{ position: [0, 3, 10], fov: 40 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} />
                <SpinningVehicle type={selectedVehicle} />
              </Canvas>

              {vehicles.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous vehicle"
                    onClick={() => cycleVehicle(-1)}
                    className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-cream/20 bg-bg-raised/80 text-cream transition-colors hover:border-cream/50 hover:bg-cream/10"
                  >
                    <Chevron dir="left" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next vehicle"
                    onClick={() => cycleVehicle(1)}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-cream/20 bg-bg-raised/80 text-cream transition-colors hover:border-cream/50 hover:bg-cream/10"
                  >
                    <Chevron dir="right" />
                  </button>
                  <span className="absolute right-2 top-2 text-[9px] tabular-nums text-muted/70">
                    {currentIndex + 1} / {vehicles.length}
                  </span>
                </>
              )}

              <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-wider text-cream">
                {selectedVehicleName}
              </p>
            </div>
          </div>

          {/* VS Matchup */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
            <FighterCard
              avatar={preview.attacker_avatar}
              login={preview.attacker_login}
              role="attack"
              estimate={preview.attack_estimate}
              score={preview.attack_score}
              breakdown={preview.attack_breakdown}
            />

            <div className="flex items-center justify-center">
              <span className="font-silkscreen text-lg text-red-500">VS</span>
            </div>

            <FighterCard
              avatar={preview.defender_avatar}
              login={preview.defender_login}
              role="defense"
              estimate={preview.defense_estimate}
              score={preview.defense_score}
              breakdown={preview.defense_breakdown}
              hidden
            />
          </div>

          {/* Boost Selector */}
          {preview.available_boosts.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Use Boost</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBoost(null)}
                  className={`flex-1 border px-2 py-1.5 text-[10px] transition-colors ${
                    !selectedBoost
                      ? "border-cream/40 bg-cream/10 text-cream"
                      : "border-cream/10 text-muted hover:border-cream/20"
                  }`}
                >
                  None
                </button>
                {preview.available_boosts.map((boost) => (
                  <button
                    key={boost.purchase_id}
                    onClick={() => setSelectedBoost(boost)}
                    className={`flex-1 border px-2 py-1.5 text-[10px] transition-colors ${
                      selectedBoost?.purchase_id === boost.purchase_id
                        ? "border-orange-400/60 bg-orange-500/10 text-orange-300"
                        : "border-cream/10 text-muted hover:border-cream/20"
                    }`}
                  >
                    {boost.name}
                    <br />
                    <span className="text-orange-400">+{boost.bonus}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-center text-[10px] text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="btn-press flex-1 border-2 border-border px-3 py-2 text-xs text-cream transition-colors hover:border-border-light"
            >
              Cancel
            </button>
            <button
              onClick={() => onRaid(selectedBoost?.purchase_id, selectedVehicle)}
              disabled={loading}
              className="btn-press flex-1 border-2 border-red-500/60 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-50"
              style={{ boxShadow: "3px 3px 0 0 rgba(239,68,68,0.35)" }}
            >
              {loading ? "BATTLING..." : "BATTLE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
