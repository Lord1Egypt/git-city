"use client";

import type { CSSProperties } from "react";
import type { TitleCue } from "./film";

// Kinetic titles over a film (./film TitleCue), in the stage's
// container units (cqw) so they scale with it. The styles are in TITLE_CSS,
// which the studio mounts once.
//   tag     a word on a slanted bar, lower left: the bar wipes in, the letters pop, a small hit
//   big     the same, centred near the top
//   left / right  plates under each half of a split screen
//   center  a boxed word in the middle

export const TITLE_CSS = `
@keyframes film-bar { 0% { clip-path: polygon(0 0, 0 0, -8% 100%, -8% 100%); } 100% { clip-path: polygon(0 0, 100% 0, 92% 100%, -8% 100%); } }
@keyframes film-letter { 0% { opacity: 0; transform: translateY(40%) scale(1.6); } 60% { opacity: 1; transform: translateY(-6%) scale(0.95); } 100% { opacity: 1; transform: none; } }
@keyframes film-hit { 0%, 100% { transform: translate(0, 0) skewX(-12deg); } 20% { transform: translate(-0.6cqw, 0.3cqw) skewX(-12deg); } 40% { transform: translate(0.5cqw, -0.2cqw) skewX(-12deg); } 60% { transform: translate(-0.3cqw, 0.1cqw) skewX(-12deg); } }
@keyframes film-slam { 0% { opacity: 0; transform: scale(1.7); } 55% { opacity: 1; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
.film-tag { animation: film-hit 0.22s steps(4) 0.18s both; }
.film-tag-bar { animation: film-bar 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.film-tag-letter { display: inline-block; animation: film-letter 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.film-slam { animation: film-slam 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.film-ink { color: #0d0d0f; line-height: 1; white-space: nowrap; }
`;

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });

function Letters({ text }: { text: string }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="film-tag-letter"
          style={{ animationDelay: `${0.06 + i * 0.035}s` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </>
  );
}

function Tag({ cue, size }: { cue: TitleCue; size: string }) {
  return (
    <div key={`${cue.text}-${cue.start}`} className="film-tag" style={{ position: "relative" }}>
      <div
        className="film-tag-bar"
        style={abs({ inset: "0 -1.2cqw", background: cue.color ?? "#e8dcc8" })}
      />
      <p
        className="film-ink"
        style={{
          position: "relative",
          margin: 0,
          padding: "0.6cqw 1.6cqw",
          fontSize: size,
          textShadow: "0.35cqw 0.35cqw 0 rgba(255,255,255,0.35)",
        }}
      >
        <Letters text={cue.text} />
      </p>
    </div>
  );
}

export default function Titles({ cues }: { cues: TitleCue[] }) {
  const at = (place: TitleCue["place"]) => cues.find((c) => c.place === place);
  const tag = at("tag");
  const big = at("big");
  const center = at("center");
  return (
    <>
      {(["left", "right"] as const).map((place) => {
        const c = at(place);
        if (!c) return null;
        return (
          <div
            key={place}
            className="film-slam"
            style={abs({
              bottom: "9%",
              left: place === "left" ? 0 : "50%",
              width: "50%",
              display: "flex",
              justifyContent: "center",
            })}
          >
            <span
              className="film-ink"
              style={{
                padding: "1cqw 1.6cqw",
                fontSize: "4.2cqw",
                background: c.color,
                boxShadow: "0.5cqw 0.5cqw 0 #0d0d0f",
              }}
            >
              {c.text}
            </span>
          </div>
        );
      })}
      {tag && (
        <div style={abs({ bottom: "11%", left: "6%" })}>
          <Tag cue={tag} size="7cqw" />
        </div>
      )}
      {big && (
        <div style={abs({ left: 0, right: 0, top: "9%", display: "flex", justifyContent: "center" })}>
          <Tag cue={big} size="6.4cqw" />
        </div>
      )}
      {center && (
        <div style={abs({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" })}>
          <span
            className="film-slam"
            style={{
              display: "block",
              padding: "1cqw 1.4cqw",
              fontSize: "6cqw",
              lineHeight: 1,
              background: "#0d0d0f",
              color: "#e8dcc8",
              boxShadow: "0 0 0 0.35cqw #e8dcc8",
            }}
          >
            {center.text}
          </span>
        </div>
      )}
    </>
  );
}
