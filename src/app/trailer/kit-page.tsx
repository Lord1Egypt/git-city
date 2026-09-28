"use client";

import { useRef, useState } from "react";
import Link from "next/link";

const INSTALL = "npx skills add srizzon/git-city --skill game-trailer";
const REPO = "https://github.com/srizzon/git-city/tree/main/.claude/skills/game-trailer";

const STEPS: [string, string][] = [
  [
    "It asks you first",
    "What should people feel at the end? Teaser or trailer? The idea is yours.",
  ],
  [
    "It writes the film",
    "Short takes on the music's beat, shot in your real game: your cars, your map, your camera.",
  ],
  [
    "You watch it live",
    "A studio page in your game. Scene by scene, scrub, slow motion. Claude checks every beat before you see it.",
  ],
  ["You press record", "Music made for the cut, an end card, and one clean pass into OBS."],
];

const KIT: [string, string][] = [
  ["Studio", "Plays the film in your game, with editor keys and a record mode"],
  ["Film format", "Takes, trims, freezes and hits on a beat grid"],
  ["Titles and end card", "Kinetic words, a stamped logo, a slot for your gag"],
  ["Music and sound", "Synthesized to the film's BPM, no samples, no license"],
  ["The craft", "What we learned cutting a teaser, written for Claude to follow"],
];

function Install() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // No clipboard (http, or denied): the command stays selectable.
    }
  };
  return (
    <div className="flex items-stretch border-[3px] border-border bg-bg-card">
      <code className="min-w-0 flex-1 px-4 py-3 text-xs break-words text-cream normal-case select-all sm:text-sm sm:whitespace-nowrap">
        <span className="text-dim">$ </span>
        {INSTALL}
      </code>
      <button
        type="button"
        onClick={copy}
        className="btn-press shrink-0 border-l-[3px] border-border px-4 text-xs text-lime hover:bg-bg-raised"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** A pixel speaker: sound waves when on, an X when muted. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden
    >
      <rect x="0" y="4" width="2" height="3" />
      <rect x="2" y="3" width="1" height="5" />
      <rect x="3" y="2" width="1" height="7" />
      <rect x="4" y="1" width="1" height="9" />
      {muted ? (
        <>
          <rect x="6" y="3" width="1" height="1" />
          <rect x="7" y="4" width="1" height="1" />
          <rect x="8" y="5" width="1" height="1" />
          <rect x="9" y="6" width="1" height="1" />
          <rect x="10" y="7" width="1" height="1" />
          <rect x="10" y="3" width="1" height="1" />
          <rect x="9" y="4" width="1" height="1" />
          <rect x="7" y="6" width="1" height="1" />
          <rect x="6" y="7" width="1" height="1" />
        </>
      ) : (
        <>
          <rect x="6" y="4" width="1" height="3" />
          <rect x="8" y="2" width="1" height="1" />
          <rect x="9" y="3" width="1" height="5" />
          <rect x="8" y="8" width="1" height="1" />
        </>
      )}
    </svg>
  );
}

function Teaser() {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    // With sound, start over: the music is cut to the picture.
    if (!v.muted) v.currentTime = 0;
    void v.play();
    setMuted(v.muted);
  };
  return (
    <figure className="border-[3px] border-border bg-bg-card">
      <div className="relative">
        <video
          ref={video}
          className="block aspect-video w-full bg-black"
          src="/trailer-kit/towns-teaser.mp4"
          poster="/trailer-kit/towns-teaser.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        {/* Sound, the way video players do it: a speaker, crossed out while muted. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={muted ? "Turn sound on" : "Mute"}
          title={muted ? "Turn sound on" : "Mute"}
          className="absolute bottom-3 left-3 flex size-10 items-center justify-center bg-black/60 text-cream transition-colors hover:bg-black/80 hover:text-lime"
        >
          <SpeakerIcon muted={muted} />
        </button>
      </div>
      <figcaption className="border-t-[3px] border-border px-4 py-3">
        <span className="text-xs text-muted normal-case">
          Git City Towns teaser. Recorded in one take, straight from the game.
        </span>
      </figcaption>
    </figure>
  );
}

export default function KitPage() {
  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; City
        </Link>
        <a href={REPO} className="text-xs text-muted transition-colors hover:text-cream">
          GitHub &rarr;
        </a>
      </nav>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-4xl px-4 pt-10 text-center sm:px-6 sm:pt-14">
          <p className="text-xs tracking-widest text-muted sm:text-sm">Git City Trailer Kit</p>
          <h1 className="mt-4 text-3xl leading-tight text-cream sm:text-5xl">
            Claude makes your
            <span className="block text-lime">game&apos;s trailer</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-cream normal-case sm:text-lg">
            Played live in your engine, recorded in one take. No video editor.
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-4xl px-4 sm:px-6">
          <Teaser />
        </div>
        <div className="mx-auto mt-6 max-w-2xl px-4 sm:px-6">
          <Install />
          <p className="mt-3 text-center text-sm text-muted normal-case">
            Then ask Claude Code:{" "}
            <span className="text-cream">&ldquo;Make a teaser for my game.&rdquo;</span>
          </p>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-4xl px-4 sm:px-6">
        <h2 className="text-lg text-cream sm:text-xl">How it goes</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="border-[3px] border-border bg-bg-card p-4 sm:p-5">
              <p className="text-xs text-lime">{i + 1}</p>
              <p className="mt-2 text-sm text-cream sm:text-base">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted normal-case">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-20 max-w-4xl px-4 sm:px-6">
        <h2 className="text-lg text-cream sm:text-xl">In the skill</h2>
        <p className="mt-1 text-xs text-muted normal-case">
          MIT. Works in any React web game: three.js, canvas or plain DOM.
        </p>
        <dl className="mt-4 border-[3px] border-border bg-bg-card">
          {KIT.map(([name, what], i) => (
            <div
              key={name}
              className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6 ${i ? "border-t-[3px] border-border" : ""}`}
            >
              <dt className="text-sm text-cream sm:w-52 sm:shrink-0">{name}</dt>
              <dd className="text-sm text-muted normal-case">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto mt-20 max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 border-[3px] border-border bg-bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-cream sm:text-base">Try the studio</p>
            <p className="mt-1 text-sm text-muted normal-case">
              A demo film built with the kit. Space plays, arrows step, Shift R records.
            </p>
          </div>
          <Link
            href="/trailer/demo"
            className="btn-press shrink-0 bg-lime px-4 py-3 text-xs tracking-widest text-bg sm:text-sm"
          >
            &#9654; Open the demo
          </Link>
        </div>
      </section>
    </main>
  );
}
