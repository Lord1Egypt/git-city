"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { beatOf, type Transport } from "@/lib/trailer/clock";
import type { Film, Frame, Scene, SoundCue } from "@/lib/trailer/film";
import Titles, { TITLE_CSS } from "./Titles";

// A small editor for a Film (lib/trailer/film), played live in the engine:
// the film in a 16:9 stage, its scenes to pick from (a picked scene loops),
// play, pause, scrub, slow motion, editor keys, and Record, which plays the
// whole film full window with no cursor and no panel after a second of
// black, for a screen recorder to capture. The film's pictures come from
// `children`, called with the frame on screen; they read the same clock.
//
// The tree never changes shape between editing and recording, so canvases
// inside the stage never remount (a remount drops their WebGL context).
// Music plays through an <audio> element synced to the clock at full speed;
// sound effects go through Web Audio, one source per cue, on their beats.

const RATES = [1, 0.5, 0.25];

const CSS = `
${TITLE_CSS}
.film-recording, .film-recording * { cursor: none !important; }
body > .fixed.bottom-4.left-3 { display: none !important; }
`;

const KEYS: [string, string][] = [
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
];

/** Web Audio for the effects: files decoded once, woken by the first key or click (autoplay rules). */
function useSoundEffects(sounds: SoundCue[]) {
  const play = useRef<((c: SoundCue) => void) | null>(null);
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
      for (const c of sounds) load(c.src);
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    play.current = (cue) => {
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
  }, [sounds]);
  return play;
}

export default function Studio<S extends string>({
  film,
  clock,
  onReset,
  children,
}: {
  film: Film<S>;
  clock: Transport;
  /** A new take, a loop, or a seek back: put the world back as it was (rebuild anything a take broke). */
  onReset: () => void;
  /** The pictures for the frame on screen. */
  children: (frame: Frame<S>) => ReactNode;
}) {
  const { beat: BEAT, length: LENGTH, scenes: SCENES } = film;
  const preroll = 1 / BEAT;
  const [scene, setScene] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [recording, setRecording] = useState(false);
  const [frame, setFrame] = useState<Frame<S>>(() => film.frameAt(0));
  const [titles, setTitles] = useState<number[]>([]);
  const flash = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const clockText = useRef<HTMLSpanElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const range = useRef<[number, number]>([0, LENGTH]);
  const [shownRange, setShownRange] = useState<[number, number]>([0, LENGTH]);
  const rec = useRef(false);
  const sfx = useSoundEffects(film.sounds);
  const reset = useRef(onReset);
  useEffect(() => {
    reset.current = onReset;
  }, [onReset]);

  useEffect(() => {
    if (!film.song) return;
    const a = new Audio(film.song.src);
    a.preload = "auto";
    audio.current = a;
    return () => a.pause();
  }, [film.song]);

  const syncAudio = useCallback(
    (beat: number, on: boolean) => {
      const a = audio.current;
      if (!a) return;
      if (!on || clock.rate !== 1) return a.pause();
      const go = () => {
        a.currentTime = (film.song?.offset ?? 0) + Math.max(0, beatOf(clock)) * BEAT;
        a.volume = 1;
        a.play().catch(() => {
          // no song file yet (tools/trailer): silent
        });
      };
      if (beat < 0) window.setTimeout(go, (-beat * BEAT * 1000) / clock.rate);
      else go();
    },
    [clock, film.song, BEAT],
  );

  /** Jump to `beat`, playing or paused. Going back resets the world. */
  const seek = useCallback(
    (beat: number, play: boolean) => {
      if (beat < beatOf(clock) - 0.01) reset.current();
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
    reset.current();
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
    setRange([-preroll, LENGTH]);
    clock.speed(1);
    setRate(1);
    reset.current();
    setPlaying(true);
    seek(-preroll, true);
  };
  const stopRecord = useCallback(() => {
    rec.current = false;
    setRecording(false);
    setPlaying(false);
    setScene(null);
    range.current = [0, LENGTH];
    setShownRange(range.current);
    seek(0, false);
  }, [seek, LENGTH]);

  // Editor keys: Space plays, arrows step a frame (Shift: a beat), J/L a second,
  // Home/End the scene's ends, 1-9 a scene, 0 the film, [ ] the speed, Shift+R records.
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
      const k = e.code;
      if (k === "Space" || k === "KeyK") toggle();
      else if (k === "ArrowLeft") to(now - (e.shiftKey ? 1 : 1 / 60 / BEAT));
      else if (k === "ArrowRight") to(now + (e.shiftKey ? 1 : 1 / 60 / BEAT));
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

  // Every frame: loop the range, fire sounds on their beats, move the scrubber,
  // flash on the film's hits, and change cuts and titles when they change.
  useEffect(() => {
    let raf = 0;
    let key = "";
    let last = beatOf(clock);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let beat = beatOf(clock);
      const [a, b] = range.current;
      if (clock.held === null && clock.rate === 1 && beat > last)
        for (const c of film.sounds) if (last < c.beat && beat >= c.beat) sfx.current?.(c);
      last = beat;
      if (clock.held === null && beat >= b) {
        if (rec.current) {
          clock.hold(b - 0.001);
          audio.current?.pause();
        } else {
          reset.current();
          clock.play(a);
          syncAudio(a, true);
        }
        beat = beatOf(clock);
        last = beat - 0.001;
      }
      const f = film.frameAt(beat);
      const on = film.titles.flatMap((c, i) => (beat >= c.start && beat < c.end ? [i] : []));
      const next = JSON.stringify([f, on]);
      if (next !== key) {
        key = next;
        setFrame(f);
        setTitles(on);
      }
      if (scrub.current && document.activeElement !== scrub.current)
        scrub.current.value = String(beat);
      if (clockText.current)
        clockText.current.textContent = `${Math.max(0, beat * BEAT).toFixed(2)}s · beat ${Math.max(0, beat).toFixed(1)}`;
      let k = 0;
      for (const x of film.flashes) {
        const since = (beat - x) * BEAT;
        if (since >= 0 && since < 0.25) k = Math.max(k, 0.55 * (1 - since / 0.25));
      }
      if (flash.current) flash.current.style.opacity = String(k);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, syncAudio, film, sfx, BEAT]);

  const [r0, r1] = shownRange;
  const sceneButton = (s: Scene | null, i: number | null) => (
    <button
      key={s?.name ?? "film"}
      type="button"
      onClick={() => pick(i)}
      className={`flex items-baseline justify-between border-2 px-3 py-2 text-left text-[11px] ${scene === i ? "border-lime bg-bg-raised text-lime" : "border-border hover:border-border-light"}`}
    >
      <span>{s ? `${(i ?? 0) + 1}. ${s.name}` : "Whole film"}</span>
      <span className="tabular-nums text-muted">
        {(((s ? s.end - s.start : LENGTH) * BEAT) as number).toFixed(1)}s
      </span>
    </button>
  );

  return (
    <main
      className={`min-h-screen bg-bg font-pixel uppercase text-warm ${recording ? "film-recording" : ""}`}
    >
      <style>{CSS}</style>
      <div className="mx-auto flex max-w-[1500px] gap-4 p-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            className={
              recording
                ? "fixed inset-0 z-50 overflow-hidden bg-black"
                : "relative aspect-video w-full overflow-hidden bg-black"
            }
            style={{ containerType: "inline-size" }}
          >
            {children(frame)}
            <Titles cues={titles.map((i) => film.titles[i])} />
            <div
              ref={flash}
              className="pointer-events-none absolute inset-0 bg-white"
              style={{ opacity: 0 }}
            />
          </div>
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
          {SCENES.map((s, i) => sceneButton(s, i))}
          {sceneButton(null, null)}
          <button
            type="button"
            onClick={record}
            className="btn-press mt-4 border-2 border-[#ff5a5a] px-3 py-3 text-[12px] text-[#ff5a5a]"
          >
            ● Record
          </button>
          <p className="text-[10px] normal-case leading-relaxed text-muted">
            Record: full window, no cursor, 1s of black, then the whole film once. Start the screen
            recorder first. Esc comes back.
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] normal-case text-muted">
            {KEYS.map(([key, what]) => (
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
