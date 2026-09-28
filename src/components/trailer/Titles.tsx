"use client";

import type { TitleCue } from "@/lib/trailer/film";

// Kinetic titles over a film (lib/trailer/film TitleCue), in the stage's
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
`;

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
    <div key={`${cue.text}-${cue.start}`} className="film-tag relative">
      <div
        className="film-tag-bar absolute inset-0 -mx-[1.2cqw]"
        style={{ background: cue.color ?? "#e8dcc8" }}
      />
      <p
        className="relative whitespace-nowrap px-[1.6cqw] py-[0.6cqw] leading-none text-[#0d0d0f]"
        style={{ fontSize: size, textShadow: "0.35cqw 0.35cqw 0 rgba(255,255,255,0.35)" }}
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
            className="film-slam absolute bottom-[9%] flex justify-center"
            style={{ left: place === "left" ? 0 : "50%", width: "50%" }}
          >
            <span
              className="px-[1.6cqw] py-[1cqw] text-[4.2cqw] leading-none text-[#0d0d0f]"
              style={{ background: c.color, boxShadow: "0.5cqw 0.5cqw 0 #0d0d0f" }}
            >
              {c.text}
            </span>
          </div>
        );
      })}
      {tag && (
        <div className="absolute bottom-[11%] left-[6%]">
          <Tag cue={tag} size="7cqw" />
        </div>
      )}
      {big && (
        <div className="absolute inset-x-0 top-[9%] flex justify-center">
          <Tag cue={big} size="6.4cqw" />
        </div>
      )}
      {center && (
        <div className="film-slam absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            className="block bg-[#0d0d0f] px-[1.4cqw] py-[1cqw] text-[6cqw] leading-none text-cream"
            style={{ boxShadow: "0 0 0 0.35cqw #e8dcc8" }}
          >
            {center.text}
          </span>
        </div>
      )}
    </>
  );
}
