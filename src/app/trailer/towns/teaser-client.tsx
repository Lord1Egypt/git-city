"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  generateCityLayout,
  type CityBuilding,
  type DeveloperRecord,
  type LayoutNorms,
} from "@/lib/github";
import type { LeagueCity } from "@/lib/league-city/service";
import type { CityObject } from "@/lib/league-city/types";
import { LOT } from "@/lib/league-city/grid";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { smashStoreFor } from "@/lib/league-city/smash";
import {
  BEAT,
  BLASTS,
  COLLAPSE,
  LENGTH,
  SCENES,
  SONG_OFFSET,
  SOUNDS,
  TEXTS,
  frameAt,
  smashRun,
  type Frame,
  type SoundCue,
  type Stage,
} from "@/lib/trailer/teaser";
import TeaserRig, { beatOf, TeaserTransport } from "@/components/trailer/TeaserRig";

const LeagueScene = dynamic(() => import("@/components/league/LeagueScene"), {
  ssr: false,
  loading: () => null,
});

// A small studio for the teaser (lib/trailer/teaser): the film in a 16:9
// stage, the scenes to pick from, play, pause, scrub and slow motion. A
// picked scene loops. Record plays the whole film full window, no cursor, no
// panel, after a second of black; Esc comes back. Each town is its own
// canvas that never remounts; a cut only changes which one shows, and the
// split shows the middle half of each. The song plays when
// /trailer/teaser.mp3 exists (kept out of the repo).

export interface TeaserSide {
  slug: string;
  name: string;
  color: string;
  city: LeagueCity;
  cityDevs: Record<string, unknown>[];
}

const PREROLL_BEATS = 1 / BEAT;
/** The login planted on the Codex rubble. */
const ATTACKER = "srizzon";
const RATES = [1, 0.5, 0.25];

function useTown(side: TeaserSide, cityNorms: LayoutNorms, gen: number) {
  const base = useMemo(() => {
    const devs = side.cityDevs as unknown as DeveloperRecord[];
    const layout = generateCityLayout(devs, undefined, cityNorms);
    const byLogin = new Map(layout.buildings.map((b) => [b.loginLower, b]));
    const byDevId = new Map<number, CityBuilding>();
    for (const d of devs) {
      const b = byLogin.get(d.github_login.toLowerCase());
      if (b) byDevId.set(d.id, b);
    }
    const real = leagueBuildings(side.city.objects, scaleTownHeights(byDevId));
    const run = real.length ? smashRun(side.city.objects, side.city.h, real[0]) : null;
    const buildings = run ? [...real, ...run.buildings] : real;
    const portal = side.city.objects.find((o) => o.item_type === "portal");
    return { buildings, run, gateZ: portal?.pz ?? 24, revZ: plainStreet(side.city.objects) };
  }, [side, cityNorms]);
  // A fresh store puts every building back up (a new take, a loop, a seek back).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => smashStoreFor(base.buildings), [base, gen]);
  return { ...base, store };
}

/** Props on the road that would sit in the burnout shot (pads, bumps, ramps). */
const ON_ROAD = new Set([
  "boost_pad",
  "speed_bump",
  "ramp",
  "ramp_big",
  "cone",
  "tire_wall",
  "crates",
]);

/** A lot row on the main street near the entrance with nothing on the road, as a world z. */
function plainStreet(objects: readonly CityObject[]): number {
  for (let z = -2; z >= -12; z--) {
    const busy = objects.some(
      (o) =>
        o.item_type !== null &&
        ON_ROAD.has(o.item_type) &&
        Math.abs(o.x) <= 1 &&
        Math.abs(o.z - z) <= 1,
    );
    if (!busy) return z * LOT;
  }
  return -2 * LOT;
}

const CSS = `
@keyframes teaser-bar { 0% { clip-path: polygon(0 0, 0 0, -8% 100%, -8% 100%); } 100% { clip-path: polygon(0 0, 100% 0, 92% 100%, -8% 100%); } }
@keyframes teaser-letter { 0% { opacity: 0; transform: translateY(40%) scale(1.6); } 60% { opacity: 1; transform: translateY(-6%) scale(0.95); } 100% { opacity: 1; transform: none; } }
@keyframes teaser-hit { 0%, 100% { transform: translate(0, 0) skewX(-12deg); } 20% { transform: translate(-0.6cqw, 0.3cqw) skewX(-12deg); } 40% { transform: translate(0.5cqw, -0.2cqw) skewX(-12deg); } 60% { transform: translate(-0.3cqw, 0.1cqw) skewX(-12deg); } }
.teaser-tag { animation: teaser-hit 0.22s steps(4) 0.18s both; }
.teaser-tag-bar { animation: teaser-bar 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.teaser-tag-letter { display: inline-block; animation: teaser-letter 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes teaser-slam { 0% { opacity: 0; transform: scale(1.7); } 55% { opacity: 1; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
.teaser-slam { animation: teaser-slam 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.teaser-recording, .teaser-recording * { cursor: none !important; }
body > .fixed.bottom-4.left-3 { display: none !important; }
`;

const fmt = (beat: number) => `${Math.max(0, beat * BEAT).toFixed(2)}s`;

export default function TeaserClient({
  sides,
  cityNorms,
}: {
  sides: [TeaserSide, TeaserSide];
  cityNorms: LayoutNorms;
}) {
  const [claudeSide, codexSide] = sides;
  const [gen, setGen] = useState(0);
  const claude = useTown(claudeSide, cityNorms, gen);
  const codex = useTown(codexSide, cityNorms, gen);
  const [clock] = useState(() => new TeaserTransport(0));

  const [scene, setScene] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [recording, setRecording] = useState(false);
  const [frame, setFrame] = useState<Frame>(frameAt(0));
  const [texts, setTexts] = useState<number[]>([]);
  const flash = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const clockText = useRef<HTMLSpanElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const range = useRef<[number, number]>([0, LENGTH]);
  const [shownRange, setShownRange] = useState<[number, number]>([0, LENGTH]);
  const rec = useRef(false);

  // Effects through Web Audio: every file decoded once, each cue its own source.
  const sfx = useRef<((c: SoundCue) => void) | null>(null);
  useEffect(() => {
    let ctx: AudioContext | null = null;
    const buffers = new Map<string, Promise<AudioBuffer | null>>();
    const load = (src: string) => {
      if (!ctx) return null;
      const c = ctx;
      if (!buffers.has(src))
        buffers.set(
          src,
          fetch(src)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(src))))
            .then((b) => c.decodeAudioData(b))
            .catch(() => null),
        );
      return buffers.get(src)!;
    };
    const wake = () => {
      ctx ??= new AudioContext();
      void ctx.resume();
      for (const c of SOUNDS) load(c.src);
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    sfx.current = (cue) => {
      wake();
      const c = ctx;
      void load(cue.src)?.then((buf) => {
        if (!buf || !c) return;
        const node = c.createBufferSource();
        node.buffer = buf;
        node.playbackRate.value = cue.rate ?? 1;
        const gain = c.createGain();
        gain.gain.value = cue.gain;
        node.connect(gain).connect(c.destination);
        node.loop = cue.dur !== undefined && cue.dur > buf.duration;
        node.start();
        if (cue.dur !== undefined) {
          gain.gain.setTargetAtTime(0, c.currentTime + cue.dur - 0.08, 0.04);
          node.stop(c.currentTime + cue.dur + 0.2);
        }
      });
    };
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      void ctx?.close();
    };
  }, []);

  useEffect(() => {
    const a = new Audio("/trailer/teaser.mp3");
    a.preload = "auto";
    audio.current = a;
    return () => a.pause();
  }, []);

  const syncAudio = useCallback(
    (beat: number, on: boolean) => {
      const a = audio.current;
      if (!a) return;
      if (!on || clock.rate !== 1) return a.pause();
      const go = () => {
        a.currentTime = SONG_OFFSET + Math.max(0, beatOf(clock)) * BEAT;
        a.volume = 1;
        a.play().catch(() => {
          // no song file: silent
        });
      };
      if (beat < 0) window.setTimeout(go, (-beat * BEAT * 1000) / clock.rate);
      else go();
    },
    [clock],
  );

  /** Jump to `beat`, playing or paused. Going back puts the buildings back up. */
  const seek = useCallback(
    (beat: number, play: boolean) => {
      if (beat < beatOf(clock) - 0.01) setGen((g) => g + 1);
      if (play) clock.play(beat);
      else clock.hold(beat);
      syncAudio(beat, play);
    },
    [clock, syncAudio],
  );

  const setRange = (r: [number, number]) => {
    range.current = r;
    setShownRange(r);
  };
  const pick = (i: number | null) => {
    setScene(i);
    setRange(i === null ? [0, LENGTH] : [SCENES[i].start, SCENES[i].end]);
    setGen((g) => g + 1);
    seek(range.current[0], playing);
  };
  const toggle = () => {
    const next = !playing;
    setPlaying(next);
    seek(beatOf(clock), next);
  };
  const changeRate = (r: number) => {
    const beat = beatOf(clock);
    clock.speed(r);
    setRate(r);
    seek(beat, playing);
  };
  const record = () => {
    rec.current = true;
    setRecording(true);
    setScene(null);
    setRange([-PREROLL_BEATS, LENGTH]);
    clock.speed(1);
    setRate(1);
    setGen((g) => g + 1);
    setPlaying(true);
    seek(-PREROLL_BEATS, true);
  };
  const stopRecord = useCallback(() => {
    rec.current = false;
    setRecording(false);
    setPlaying(false);
    setScene(null);
    range.current = [0, LENGTH];
    setShownRange(range.current);
    seek(0, false);
  }, [seek]);

  // Editor keys: Space plays, arrows step a frame (Shift: a beat), J/L a second,
  // Home/End the scene's ends, 1-7 a scene, 0 the film, [ ] the speed, Shift+R records.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e) => {
      if (rec.current) {
        if (e.code === "Escape") stopRecord();
        return;
      }
      const [a, b] = range.current;
      const to = (beat: number) => {
        setPlaying(false);
        seek(Math.min(b - 0.001, Math.max(a, beat)), false);
      };
      const now = beatOf(clock);
      const frameBeats = 1 / 60 / BEAT;
      const k = e.code;
      if (k === "Space" || k === "KeyK") toggle();
      else if (k === "ArrowLeft") to(now - (e.shiftKey ? 1 : frameBeats));
      else if (k === "ArrowRight") to(now + (e.shiftKey ? 1 : frameBeats));
      else if (k === "KeyJ") to(now - 1 / BEAT);
      else if (k === "KeyL") to(now + 1 / BEAT);
      else if (k === "Home") to(a);
      else if (k === "End") to(b);
      else if (/^Digit[1-9]$/.test(k) && Number(k.slice(5)) <= SCENES.length)
        pick(Number(k.slice(5)) - 1);
      else if (k === "Digit0") pick(null);
      else if (k === "BracketLeft")
        changeRate(RATES[Math.min(RATES.length - 1, RATES.indexOf(rate) + 1)]);
      else if (k === "BracketRight") changeRate(RATES[Math.max(0, RATES.indexOf(rate) - 1)]);
      else if (k === "KeyR" && e.shiftKey) record();
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Loops the range, moves the scrubber, and changes cuts and titles on their beats.
  useEffect(() => {
    let raf = 0;
    let key = "";
    let last = beatOf(clock);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let beat = beatOf(clock);
      const [a, b] = range.current;
      // Sound effects on their beats, while it plays at full speed.
      if (clock.held === null && clock.rate === 1 && beat > last)
        for (const c of SOUNDS) if (last < c.beat && beat >= c.beat) sfx.current?.(c);
      last = beat;
      if (clock.held === null && beat >= b) {
        if (rec.current) {
          clock.hold(b - 0.001);
          audio.current?.pause();
        } else {
          setGen((g) => g + 1);
          clock.play(a);
          syncAudio(a, true);
        }
        beat = beatOf(clock);
        last = beat - 0.001;
      }
      const f = frameAt(beat);
      const on = TEXTS.flatMap((c, i) => (beat >= c.start && beat < c.end ? [i] : []));
      const next = JSON.stringify([f, on]);
      if (next !== key) {
        key = next;
        setFrame(f);
        setTexts(on);
      }
      if (scrub.current && document.activeElement !== scrub.current)
        scrub.current.value = String(beat);
      if (clockText.current)
        clockText.current.textContent = `${fmt(beat)} · beat ${Math.max(0, beat).toFixed(1)}`;
      let k = 0;
      for (const x of [...BLASTS, COLLAPSE]) {
        const since = (beat - x) * BEAT;
        if (since >= 0 && since < 0.25)
          k = Math.max(k, (x === COLLAPSE ? 0.9 : 0.55) * (1 - since / 0.25));
      }
      if (flash.current) flash.current.style.opacity = String(k);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, syncAudio]);

  const box = (stage: Stage): React.CSSProperties => {
    if (frame.kind === "split")
      return { left: stage === "claude" ? 0 : "50%", width: "50%", visibility: "visible" };
    const show = frame.kind === "full" && frame.stage === stage;
    return { left: 0, width: "100%", visibility: show ? "visible" : "hidden" };
  };
  // Split: each half shows the middle of its town's full-width picture.
  const inner: React.CSSProperties =
    frame.kind === "split" ? { left: "-50%", width: "200%" } : { left: 0, width: "100%" };

  const town = (stage: Stage) => {
    const side = stage === "claude" ? claudeSide : codexSide;
    const other = stage === "claude" ? codexSide : claudeSide;
    const t = stage === "claude" ? claude : codex;
    return (
      <div className="absolute inset-y-0 overflow-hidden" style={box(stage)}>
        <div className="absolute inset-y-0" style={inner}>
          <LeagueScene
            embedded
            cinematic
            dpr={2}
            framing={{ zoom: 1, shiftPx: 0 }}
            h={side.city.h}
            identity={side.city.identity}
            name={side.name}
            objects={side.city.objects}
            buildings={t.buildings}
            mode="view"
            smash={{ store: t.store, color: side.color, rivalLogoUrl: other.city.identity.logoUrl }}
          >
            <TeaserRig
              stage={stage}
              clock={clock}
              h={side.city.h}
              gateZ={t.gateZ}
              revZ={t.revZ}
              run={t.run}
              store={t.store}
              homeColor={side.color}
              rivalColor={other.color}
              attacker={ATTACKER}
            />
          </LeagueScene>
        </div>
      </div>
    );
  };

  const shown = texts.map((i) => TEXTS[i]);
  const cue = (place: string) => shown.find((c) => c.place === place);
  const [r0, r1] = shownRange;

  const stageView = (
    <div
      className={
        recording
          ? "fixed inset-0 z-50 overflow-hidden bg-black"
          : "relative aspect-video w-full overflow-hidden bg-black"
      }
      style={{ containerType: "inline-size" }}
    >
      {town("claude")}
      {town("codex")}
      {frame.kind === "black" && <div className="absolute inset-0 bg-black" />}

      {(["left", "right"] as const).map((place) => {
        const c = cue(place);
        if (!c) return null;
        const color = place === "left" ? claudeSide.color : codexSide.color;
        return (
          <div
            key={place}
            className="teaser-slam absolute bottom-[9%] flex justify-center"
            style={{ left: place === "left" ? 0 : "50%", width: "50%" }}
          >
            <span
              className="px-[1.6cqw] py-[1cqw] text-[4.2cqw] leading-none text-[#0d0d0f]"
              style={{ background: color, boxShadow: "0.5cqw 0.5cqw 0 #0d0d0f" }}
            >
              {c.text}
            </span>
          </div>
        );
      })}
      {cue("tag") && (
        <div
          key={`${cue("tag")!.text}-${cue("tag")!.start}`}
          className="teaser-tag absolute bottom-[11%] left-[6%]"
        >
          <div
            className="teaser-tag-bar absolute inset-0 -mx-[1.2cqw]"
            style={{ background: cue("tag")!.color }}
          />
          <p
            className="relative px-[1.6cqw] py-[0.6cqw] text-[7cqw] leading-none text-[#0d0d0f]"
            style={{ textShadow: "0.35cqw 0.35cqw 0 rgba(255,255,255,0.35)" }}
          >
            {[...cue("tag")!.text].map((ch, i) => (
              <span
                key={i}
                className="teaser-tag-letter"
                style={{ animationDelay: `${0.06 + i * 0.035}s` }}
              >
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </p>
        </div>
      )}
      {cue("big") && (
        <div className="absolute inset-x-0 top-[9%] flex justify-center">
          <div key={`${cue("big")!.text}-${cue("big")!.start}`} className="teaser-tag relative">
            <div
              className="teaser-tag-bar absolute inset-0 -mx-[1.2cqw]"
              style={{ background: cue("big")!.color }}
            />
            <p
              className="relative px-[1.6cqw] py-[0.6cqw] text-[6.4cqw] whitespace-nowrap leading-none text-[#0d0d0f]"
              style={{ textShadow: "0.35cqw 0.35cqw 0 rgba(255,255,255,0.35)" }}
            >
              {[...cue("big")!.text].map((ch, i) => (
                <span
                  key={i}
                  className="teaser-tag-letter"
                  style={{ animationDelay: `${0.06 + i * 0.035}s` }}
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}
      {cue("center") && (
        <div className="teaser-slam absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            className="block bg-[#0d0d0f] px-[1.4cqw] py-[1cqw] text-[6cqw] leading-none text-cream"
            style={{ boxShadow: "0 0 0 0.35cqw #e8dcc8" }}
          >
            {cue("center")!.text}
          </span>
        </div>
      )}
      {frame.kind === "black" && shown.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqw]">
          {cue("end1") && (
            <p className="teaser-slam text-[5cqw] leading-none text-cream">{cue("end1")!.text}</p>
          )}
          {cue("end2") && (
            <p className="teaser-slam text-[3cqw] leading-none text-muted">{cue("end2")!.text}</p>
          )}
          {cue("end3") && (
            <p className="teaser-slam text-[3cqw] leading-none text-lime">{cue("end3")!.text}</p>
          )}
        </div>
      )}
      <div
        ref={flash}
        className="pointer-events-none absolute inset-0 bg-white"
        style={{ opacity: 0 }}
      />
    </div>
  );

  return (
    <main
      className={`min-h-screen bg-bg font-pixel uppercase text-warm ${recording ? "teaser-recording" : ""}`}
    >
      <style>{CSS}</style>
      {/* Recording keeps the same tree (the canvases never remount); the panel just hides. */}
      <div className="mx-auto flex max-w-[1500px] gap-4 p-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {stageView}
          <div
            className={`flex flex-wrap items-center gap-3 border-2 border-border bg-bg-raised px-3 py-2 text-[11px] ${recording ? "hidden" : ""}`}
          >
            <button
              type="button"
              onClick={toggle}
              className="btn-press w-20 border-2 border-lime py-1.5 text-lime"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => seek(r0, playing)}
              className="border-2 border-border px-3 py-1.5 hover:border-border-light"
            >
              Restart
            </button>
            <input
              ref={scrub}
              type="range"
              min={Math.max(0, r0)}
              max={r1}
              step={0.01}
              defaultValue={r0}
              onChange={(e) => seek(Number(e.target.value), playing)}
              aria-label="Scrub"
              className="min-w-40 flex-1 accent-lime"
            />
            <span ref={clockText} className="w-40 text-right tabular-nums text-muted" />
            <div className="flex">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => changeRate(r)}
                  className={`border-2 px-2 py-1.5 ${rate === r ? "border-lime text-lime" : "border-border text-muted"}`}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside
          className={`flex w-72 shrink-0 flex-col gap-2 max-lg:w-full ${recording ? "hidden" : ""}`}
        >
          <p className="text-[10px] text-muted">Scenes · a picked scene loops</p>
          {SCENES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => pick(i)}
              className={`flex items-baseline justify-between border-2 px-3 py-2 text-left text-[11px] ${scene === i ? "border-lime bg-bg-raised text-lime" : "border-border hover:border-border-light"}`}
            >
              <span>
                {i + 1}. {s.name}
              </span>
              <span className="tabular-nums text-muted">
                {((s.end - s.start) * BEAT).toFixed(1)}s
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => pick(null)}
            className={`border-2 px-3 py-2 text-left text-[11px] ${scene === null ? "border-lime bg-bg-raised text-lime" : "border-border hover:border-border-light"}`}
          >
            Whole film · {(LENGTH * BEAT).toFixed(1)}s
          </button>
          <button
            type="button"
            onClick={record}
            className="btn-press mt-4 border-2 border-[#ff5a5a] px-3 py-3 text-[12px] text-[#ff5a5a]"
          >
            ● Record
          </button>
          <p className="text-[10px] normal-case leading-relaxed text-muted">
            Record: full window, no cursor, 1s of black, then the whole film once. Start OBS first.
            Esc comes back.
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] normal-case text-muted">
            {[
              ["Space", "Play / pause"],
              ["← →", "One frame"],
              ["Shift ← →", "One beat"],
              ["J  L", "One second"],
              ["Home  End", "Scene start / end"],
              ["1–9", "Pick a scene"],
              ["0", "Whole film"],
              ["[  ]", "Slower / faster"],
              ["Shift R", "Record"],
              ["Esc", "Stop recording"],
            ].map(([key, what]) => (
              <div key={key} className="contents">
                <dt className="text-warm">{key}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </main>
  );
}
