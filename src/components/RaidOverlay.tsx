"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { RaidPhase } from "@/lib/useRaidSequence";
import type { RaidExecuteResponse } from "@/lib/raid";

interface Props {
  phase: RaidPhase;
  raidData: RaidExecuteResponse | null;
  onSkip: () => void;
  onExit: () => void;
}

function AnimatedScore({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) return;
    startRef.current = null;

    function animate(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span>{value}</span>;
}

// Role accent — "you" (attack) reads as the app's lime accent, the defender as
// combat red. Matches the Battle Preview matchup cards for a coherent flow.
const ROLE_ACCENT = {
  attack: "#c8e64a",
  defense: "#ef4444",
} as const;

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
// One side of the matchup: framed avatar, login, role label, and a big score.
function Combatant({
  login,
  avatar,
  score,
  role,
  animate,
}: {
  login: string;
  avatar: string | null;
  score: number;
  role: "attack" | "defense";
  animate: boolean;
}) {
  const accent = ROLE_ACCENT[role];
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span
        className="shrink-0 border-2 p-0.5"
        style={{ borderColor: accent, backgroundColor: `${accent}14` }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="block h-12 w-12"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="block h-12 w-12 bg-border" />
        )}
      </span>
      <p className="max-w-full truncate text-[11px] font-bold text-cream">{login}</p>
      <span className="text-[8px] uppercase tracking-wider text-muted">
        {role === "attack" ? "Attack" : "Defense"}
      </span>
      <p className="font-silkscreen text-4xl leading-none tabular-nums" style={{ color: accent }}>
        {animate ? <AnimatedScore target={score} /> : score}
      </p>
    </div>
  );
}

function Chip({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  const c = gold ? "#ffd700" : "#fdba74";
  return (
    <span
      className="border px-2 py-1 text-[9px] font-bold uppercase tracking-wide"
      style={{ borderColor: `${c}55`, color: c, backgroundColor: `${c}12` }}
    >
      {children}
    </span>
  );
}

/**
 * Shareable battle result card: bold outcome headline, both combatants with
 * avatars + scores (identity = shareable), a reward strip, and a Git City
 * watermark footer with the battle id so every screenshot advertises the game.
 * `step` drives the staggered reveal.
 */
function BattleCard({
  raidData,
  isWin,
  step,
}: {
  raidData: RaidExecuteResponse;
  isWin: boolean;
  step: number;
}) {
  const lime = ROLE_ACCENT.attack;
  const winColor = isWin ? lime : ROLE_ACCENT.defense;

  const date = useMemo(() => {
    const d = new Date();
    return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
  }, []);
  const hash = useMemo(
    () => raidData.raid_id.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 7) || "0000000",
    [raidData.raid_id],
  );

  const hasRewards = raidData.xp_earned > 0 || !!raidData.new_title || raidData.new_achievements.length > 0;

  return (
    <div
      className="w-full max-w-[360px] overflow-hidden border-[3px] bg-bg-card"
      style={{
        borderColor: `${winColor}80`,
        boxShadow: `6px 6px 0 0 rgba(0,0,0,0.6), 0 0 50px ${winColor}26`,
      }}
    >
      {/* Header — outcome */}
      <div
        className="relative overflow-hidden px-5 pb-5 pt-6 text-center"
        style={{
          background: `linear-gradient(135deg, ${winColor}24 0%, ${winColor}08 55%, transparent 100%)`,
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
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted">Battle Result</p>
          <h1
            className="mt-1.5 font-silkscreen text-3xl tracking-wider md:text-4xl"
            style={{ color: winColor, textShadow: `0 0 22px ${winColor}66` }}
          >
            {isWin ? "CONQUERED" : "DEFEATED"}
          </h1>
        </div>
      </div>

      {/* Matchup */}
      <div className="flex items-center gap-3 px-5 py-5">
        <Combatant
          role="attack"
          login={raidData.attacker.login}
          avatar={raidData.attacker.avatar}
          score={raidData.attack_score}
          animate={step >= 2}
        />
        <span className="shrink-0 font-silkscreen text-lg text-muted/40">VS</span>
        <Combatant
          role="defense"
          login={raidData.defender.login}
          avatar={raidData.defender.avatar}
          score={raidData.defense_score}
          animate={step >= 2}
        />
      </div>

      {/* Reward strip */}
      {hasRewards && (
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 border-t border-border px-4 py-3"
          style={{ opacity: step >= 3 ? 1 : 0, transition: "opacity 0.35s ease-out" }}
        >
          {raidData.xp_earned > 0 && <Chip>+{raidData.xp_earned} XP</Chip>}
          {raidData.new_title && <Chip gold>★ {raidData.new_title}</Chip>}
          {raidData.new_achievements.map((a) => (
            <Chip key={a} gold>
              🏆 {a}
            </Chip>
          ))}
        </div>
      )}

      {/* Footer — branding watermark */}
      <div className="flex items-center justify-between border-t border-border bg-bg-raised/60 px-4 py-2.5 text-[8px] uppercase tracking-wider text-dim">
        <span className="font-bold" style={{ color: lime }}>
          ▣ Git City
        </span>
        <span className="tabular-nums">
          #{hash} · {date}
        </span>
      </div>
    </div>
  );
}

export default function RaidOverlay({ phase, raidData, onSkip, onExit }: Props) {
  const [barsVisible, setBarsVisible] = useState(false);
  const [revealStep, setRevealStep] = useState(0);
  const [flashPhase, setFlashPhase] = useState<"none" | "peak" | "fading">("none");

  // Cinema bars shown during cinematic phases, retract on share
  const showBars = phase !== "idle" && phase !== "preview" && phase !== "done" && phase !== "share";
  const showText = phase === "intro" || phase === "flight" || phase === "attack" || phase === "outro_win" || phase === "outro_lose";
  const showScore = phase === "share";

  useEffect(() => {
    if (showBars) {
      requestAnimationFrame(() => setBarsVisible(true));
    } else {
      setBarsVisible(false);
    }
  }, [showBars]);

  // Screen flash on explosion
  useEffect(() => {
    if (phase === "outro_win") {
      setFlashPhase("peak");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlashPhase("fading");
        });
      });
      const timer = setTimeout(() => setFlashPhase("none"), 700);
      return () => clearTimeout(timer);
    } else {
      setFlashPhase("none");
    }
  }, [phase]);

  // Staggered reveal for result screen
  useEffect(() => {
    if (!showScore) {
      setRevealStep(0);
      return;
    }

    // Reveal: card in → scores count up → reward strip → actions.
    setRevealStep(1);
    const timers = [
      setTimeout(() => setRevealStep(2), 350),
      setTimeout(() => setRevealStep(3), 1100),
      setTimeout(() => setRevealStep(4), 1500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [showScore]);

  if (!showBars && !showText && !showScore) return null;

  const attackerLogin = raidData?.attacker?.login ?? "???";
  const defenderLogin = raidData?.defender?.login ?? "???";
  const isWin = raidData?.success;

  let phaseText = "";
  switch (phase) {
    case "intro":
      phaseText = `${attackerLogin} vs ${defenderLogin}`;
      break;
    case "flight":
      phaseText = `Approaching target`;
      break;
    case "attack":
      phaseText = `Engaging`;
      break;
    case "outro_win":
      phaseText = `${defenderLogin} has fallen`;
      break;
    case "outro_lose":
      phaseText = `Attack repelled`;
      break;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-55">
      {/* Screen flash on explosion */}
      {flashPhase !== "none" && (
        <div
          className="fixed inset-0 z-60 bg-white"
          style={{
            opacity: flashPhase === "peak" ? 0.9 : 0,
            transition: flashPhase === "fading" ? "opacity 0.6s ease-out" : "none",
          }}
        />
      )}

      {/* Cinema bars - retract on share phase */}
      <div
        className="absolute left-0 right-0 top-0 bg-black"
        style={{
          height: barsVisible ? "12vh" : 0,
          transition: "height 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-black"
        style={{
          height: barsVisible ? "12vh" : 0,
          transition: "height 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Phase text (cinematic phases only) */}
      {showText && (
        <div
          className="absolute left-1/2 top-[14vh] -translate-x-1/2"
          style={{
            opacity: barsVisible ? 1 : 0,
            transform: `translateX(-50%) translateY(${barsVisible ? "0" : "10px"})`,
            transition: "opacity 0.5s ease-in-out, transform 0.5s ease-in-out",
          }}
        >
          <p className="font-silkscreen text-center text-sm tracking-wide text-cream drop-shadow-lg md:text-base">
            {phaseText}
          </p>
        </div>
      )}

      {/* ── Full-Screen Result Reveal ── */}
      {showScore && raidData && (
        <>
          {/* Dark backdrop */}
          <div
            className="fixed inset-0 bg-black/85"
            style={{
              opacity: revealStep >= 1 ? 1 : 0,
              transition: "opacity 0.4s ease-out",
            }}
          />

          {/* Centered content container */}
          <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center px-4">
            {/* Shareable battle card (terminal receipt) */}
            <div
              style={{
                opacity: revealStep >= 1 ? 1 : 0,
                transform: `scale(${revealStep >= 1 ? 1 : 0.94})`,
                transition: "opacity 0.35s ease-out, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <BattleCard raidData={raidData} isWin={!!isWin} step={revealStep} />
            </div>

            {/* Actions — outside the card so a screenshot stays clean */}
            <div
              className="mt-5 flex w-full max-w-[360px] gap-2"
              style={{
                opacity: revealStep >= 4 ? 1 : 0,
                transform: `translateY(${revealStep >= 4 ? "0" : "8px"})`,
                transition: "opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <button
                onClick={onExit}
                className="btn-press flex-1 border-2 border-border px-4 py-2.5 text-xs text-cream transition-colors hover:border-border-light"
              >
                Back to City
              </button>
              <button
                onClick={() => {
                  const text = raidData.success
                    ? `⚔️ Conquered ${defenderLogin}'s building on Git City — ${raidData.attack_score} vs ${raidData.defense_score}`
                    : `🛡️ ${defenderLogin} defended against my raid on Git City — ${raidData.attack_score} vs ${raidData.defense_score}`;
                  const shareUrl = `https://thegitcity.com/battle/${raidData.raid_id}`;
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
                  window.open(url, "_blank");
                }}
                className="btn-press flex-1 border-2 px-4 py-2.5 text-xs font-bold transition-colors"
                style={{
                  borderColor: `${isWin ? ROLE_ACCENT.attack : ROLE_ACCENT.defense}99`,
                  color: isWin ? ROLE_ACCENT.attack : ROLE_ACCENT.defense,
                }}
              >
                Share on X
              </button>
            </div>
          </div>
        </>
      )}

      {/* ESC hint during animation phases */}
      {(phase === "flight" || phase === "attack") && (
        <div className="pointer-events-auto absolute bottom-[14vh] left-1/2 -translate-x-1/2">
          <button
            onClick={onSkip}
            className="text-[9px] text-muted/50 transition-colors hover:text-muted"
          >
            Press ESC to skip
          </button>
        </div>
      )}
    </div>
  );
}
