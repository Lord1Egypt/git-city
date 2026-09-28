"use client";

import { useEffect, useState } from "react";

// The teaser's end card in the profile card's identity (lib/og/devHero):
// the accent-tinted pixel grid, a framed panel, pixel chips, one big
// building with lit windows, and the GIT CITY footer bar. Driven by the
// film's clock (beats after the hit), so a scrub shows what records. On the
// hit the building rises and its windows light row by row; TOWNS drops in
// with a «SOON» chip, then DRIVE · DRIFT · SMASH pop one per half beat. The
// button: on the late crash the building gets smashed, floors coming off
// the bottom, and the card shakes.

const OG = {
  accent: "#c8e64a",
  bg: "#0d0d0f",
  raised: "#161618",
  cardBg: "#1c1c20",
  cream: "#e8dcc8",
  border: "#2a2a30",
  borderLight: "#3a3a44",
  muted: "#8c8c9c",
};

/** Beats after the hit. */
const RISE_AT = 0.1;
const NAME_AT = 0.5;
const SOON_AT = 2;
export const CHIPS_AT = 3;
export const CHIP_EVERY = 0.5;
export const SMASH_AT = 7;

const CHIPS = ["Drive", "Drift", "Smash"];
const COLS = 5;
const ROWS = 11;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (u: number) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export default function EndCard({ beat }: { beat: () => number }) {
  const [b, setB] = useState(beat());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setB(beat());
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beat]);

  const hit = b >= 0 && b < 0.6 ? Math.exp(-b * 5) : 0;
  const smashed = b > SMASH_AT ? Math.min(ROWS, Math.floor((b - SMASH_AT) / 0.1)) : 0;
  const shake = b > SMASH_AT ? Math.exp(-(b - SMASH_AT) * 2.5) : 0;
  const jx = Math.sin(b * 90) * (shake * 0.7 + hit * 0.4);
  const jy = Math.cos(b * 70) * (shake * 0.5 + hit * 0.3);
  const rise = easeOutBack(clamp((b - RISE_AT) / 0.6));
  const footer = clamp(b / 0.25);
  // Rows light from the bottom up after the rise.
  const litRows = Math.floor(clamp((b - RISE_AT - 0.4) / 1.2) * ROWS);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: OG.bg, transform: `translate(${jx}cqw, ${jy}cqw)` }}
    >
      {/* The hero backdrop: accent tint and the pixel grid. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${rgba(OG.accent, 0.1)} 0%, ${rgba(OG.accent, 0.03)} 40%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0.035) 0.17cqw, rgba(255,255,255,0) 0.17cqw), linear-gradient(to right, rgba(255,255,255,0.035) 0.17cqw, rgba(255,255,255,0) 0.17cqw)",
          backgroundSize: "1.34cqw 1.34cqw",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ border: `0.5cqw solid ${OG.border}` }}
      />

      {/* A second, unlit building behind, as on the card. */}
      <div
        className="absolute flex flex-col gap-[0.85cqw] overflow-hidden pl-[1cqw] pt-[1.3cqw]"
        style={{
          right: "27.5%",
          bottom: "11.5%",
          width: "6cqw",
          height: `${22 * rise}cqw`,
          background: OG.cardBg,
          borderTop: `0.35cqw solid ${OG.borderLight}`,
        }}
      >
        {Array.from({ length: 7 }, (_, r) => (
          <div key={r} className="flex gap-[0.85cqw]">
            {[0, 1].map((c) => (
              <div
                key={c}
                className="size-[2cqw]"
                style={{ background: (r + c) % 3 ? "#3a3a44" : "#24242a" }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* The building, rising from the footer line; the smash takes its floors from the bottom. */}
      <div
        className="absolute overflow-hidden"
        style={{ right: "7%", bottom: "11.5%", width: "21cqw", height: `${34 * rise}cqw` }}
      >
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[0.85cqw] pt-[1.3cqw]"
          style={{
            height: `${34 * (1 - smashed / ROWS)}cqw`,
            background: OG.cardBg,
            borderTop: smashed < ROWS ? `0.5cqw solid ${OG.accent}` : undefined,
            borderLeft: `0.25cqw solid ${rgba(OG.accent, 0.31)}`,
            borderRight: `0.25cqw solid ${rgba(OG.accent, 0.31)}`,
          }}
        >
          {Array.from({ length: ROWS - smashed }, (_, r) => {
            const fromBottom = ROWS - 1 - r;
            return (
              <div key={r} className="flex gap-[0.85cqw]">
                {Array.from({ length: COLS }, (_, c) => {
                  const on = (r * 5 + c * 3) % 7 > 1 && fromBottom < litRows;
                  return (
                    <div
                      key={c}
                      className="size-[2cqw]"
                      style={{ background: on ? OG.accent : rgba(OG.accent, 0.09) }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {/* Dust where the floors come off. */}
      {smashed > 0 && smashed < ROWS + 3 && (
        <div
          className="absolute flex justify-around"
          style={{ right: "5%", width: "25cqw", bottom: "11.5%", height: "4cqw" }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="size-[1.4cqw]"
              style={{
                background: i % 2 ? OG.borderLight : OG.muted,
                transform: `translateY(${-((b * 13 + i * 7) % 3) - 0.5}cqw)`,
              }}
            />
          ))}
        </div>
      )}

      {/* TOWNS, the «SOON» chip, and the three verbs. */}
      <div className="absolute left-[6.5%] top-[31%] flex flex-col gap-[2.4cqw]">
        <div className="flex items-end gap-[2cqw]">
          <p
            className="flex text-[9cqw] leading-none"
            style={{ color: OG.cream, textShadow: "0.4cqw 0.4cqw 0 #000" }}
          >
            {[..."TOWNS"].map((ch, i) => {
              const u = clamp((b - NAME_AT - i * 0.1) / 0.3);
              return (
                <span
                  key={i}
                  style={{
                    opacity: u > 0 ? 1 : 0,
                    transform: `translateY(${(1 - easeOutBack(u)) * -30}cqw)`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </p>
          {b >= SOON_AT && (
            <p
              className="mb-[1.1cqw] text-[2.6cqw] leading-none"
              style={{
                color: OG.accent,
                transform: `scale(${1 + 0.4 * Math.exp(-(b - SOON_AT) * 8)})`,
                transformOrigin: "left bottom",
              }}
            >
              «SOON»
            </p>
          )}
        </div>
        <div className="flex gap-[1.2cqw]">
          {CHIPS.map((text, i) => {
            const at = CHIPS_AT + i * CHIP_EVERY;
            if (b < at) return null;
            return (
              <div
                key={text}
                className="flex items-center gap-[0.8cqw] px-[1.2cqw] py-[0.6cqw] text-[1.7cqw] uppercase leading-none"
                style={{
                  color: OG.muted,
                  border: `0.2cqw solid ${OG.borderLight}`,
                  background: rgba(OG.bg, 0.5),
                  transform: `scale(${1 + 0.3 * Math.exp(-(b - at) * 10)})`,
                }}
              >
                <span className="size-[0.7cqw]" style={{ background: OG.accent }} />
                {text}
              </div>
            );
          })}
        </div>
      </div>

      {/* The footer bar. */}
      <div
        className="absolute inset-x-0 bottom-0 flex h-[11.5%] items-center justify-between px-[5.5%]"
        style={{
          background: OG.raised,
          borderTop: `0.35cqw solid ${OG.accent}`,
          transform: `translateY(${(1 - footer) * 100}%)`,
        }}
      >
        <p className="text-[2.4cqw] leading-none">
          <span style={{ color: OG.cream }}>GIT </span>
          <span style={{ color: OG.accent }}>CITY</span>
        </p>
        <p className="text-[1.6cqw] leading-none" style={{ color: OG.cream }}>
          THEGITCITY.COM
        </p>
      </div>
    </div>
  );
}
