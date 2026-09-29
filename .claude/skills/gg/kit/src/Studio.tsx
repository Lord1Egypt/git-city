"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { beatOf, type Transport } from "./clock";
import type { Film, Frame, SoundCue } from "./film";
import Titles, { TITLE_CSS } from "./Titles";

// A small editor for a Film (./film), played live in the engine:
// the film in a 16:9 stage, its scenes to pick from (a picked scene loops),
// play, pause, scrub, slow motion, editor keys, and Record, which plays the
// whole film full window with no cursor and no panel after a second of
// black, for a screen recorder to capture. Opened with ?export, it waits for
// tools/export.mjs to drive it frame by frame instead (window.__gg). The film's pictures come from
// `children`, called with the frame on screen; they read the same clock.
//
// The tree never changes shape between editing and recording, so canvases
// inside the stage never remount (a remount drops their WebGL context).
// Music plays through an <audio> element synced to the clock at full speed;
// sound effects go through Web Audio, one source per cue, on their beats.
//
// Styled by its own CSS below, no framework needed. To match your game, pass
// a className that sets the --tk-* variables (colors, and --tk-font).

const RATES = [1, 0.5, 0.25];

const CSS = `
${TITLE_CSS}
/* The defaults weigh nothing (:where), so any class of yours overrides them. */
:where(.tk-studio) {
  --tk-bg: #0d0d0f; --tk-panel: #161618; --tk-line: #2a2a30; --tk-line-hi: #3a3a44;
  --tk-text: #d4cfc4; --tk-muted: #8c8c9c; --tk-accent: #c8e64a; --tk-rec: #ff5a5a;
}
.tk-studio {
  min-height: 100vh; background: var(--tk-bg); color: var(--tk-text); text-transform: uppercase;
  font-family: var(--tk-font, ui-monospace, monospace);
}
.tk-studio button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-transform: inherit; }
.tk-studio.tk-recording, .tk-studio.tk-recording * { cursor: none !important; }
.tk-wrap { position: relative; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding: 16px;
  max-width: min(1720px, calc((100vh - 148px) * 16 / 9 + 312px)); }
.tk-body { display: flex; gap: 16px; align-items: flex-start; }
.tk-main { display: flex; flex: 1; flex-direction: column; gap: 12px; min-width: 0; }
.tk-side { display: flex; flex-direction: column; gap: 2px; width: 264px; flex-shrink: 0; max-height: calc(100vh - 88px); overflow-y: auto; }
.tk-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 11px; }
.tk-title { color: var(--tk-muted); letter-spacing: 0.1em; }
.tk-actions { display: flex; align-items: center; gap: 8px; }
.tk-ghost { border: 2px solid var(--tk-line) !important; padding: 8px 12px !important; color: var(--tk-muted); }
.tk-ghost:hover, .tk-ghost.tk-on { border-color: var(--tk-line-hi) !important; color: var(--tk-text); }
.tk-ghost.tk-rec:hover { border-color: var(--tk-rec) !important; color: var(--tk-rec); }
.tk-primary { background: var(--tk-accent) !important; color: var(--tk-bg) !important; padding: 10px 16px !important; }
.tk-primary:hover { filter: brightness(1.1); }
.tk-pop { position: absolute; top: 56px; right: 16px; z-index: 20; display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100% - 32px));
  border: 2px solid var(--tk-line-hi); background: var(--tk-panel); padding: 12px; font-size: 10px; }
.tk-pop-head { display: flex; justify-content: space-between; color: var(--tk-muted); }
.tk-cmd { display: block; background: var(--tk-bg); padding: 8px; line-height: 1.5; text-transform: none; word-break: break-all; user-select: all; color: var(--tk-text); }
.tk-keys { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; text-transform: none; color: var(--tk-muted); margin: 0; }
.tk-keys dt { color: var(--tk-text); }
.tk-keys dd { margin: 0; }
.tk-stage { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #000; container-type: inline-size; }
.tk-recording .tk-stage { position: fixed; inset: 0; z-index: 50; aspect-ratio: auto; }
.tk-flash { pointer-events: none; position: absolute; inset: 0; background: #fff; opacity: 0; }
.tk-transport { display: flex; align-items: center; gap: 16px; font-size: 11px; }
.tk-play { width: 72px; border: 2px solid var(--tk-accent) !important; padding: 8px 0 !important; color: var(--tk-accent) !important; }
.tk-time { flex: 1; font-variant-numeric: tabular-nums; color: var(--tk-muted); }
.tk-time b { font-weight: inherit; color: var(--tk-text); }
.tk-rates { display: flex; gap: 12px; }
.tk-rates button { color: var(--tk-muted); }
.tk-rates button.tk-on { color: var(--tk-accent); }
.tk-timeline { position: relative; user-select: none; touch-action: none; }
.tk-ruler { position: relative; height: 12px; background: var(--tk-panel); cursor: ew-resize; }
.tk-loop { position: absolute; top: 0; bottom: 0; background: var(--tk-line-hi); }
.tk-cut { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--tk-bg); }
.tk-scene { display: flex; gap: 12px; justify-content: space-between; border: 2px solid transparent !important; padding: 10px 12px !important; text-align: left; font-size: 11px;
  color: var(--tk-muted); }
.tk-scene span:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tk-scene span:last-child { font-variant-numeric: tabular-nums; }
.tk-scene.tk-all { margin-top: 8px; }
.tk-scene:hover { border-color: var(--tk-line-hi) !important; color: var(--tk-text); }
.tk-scene.tk-on { border-color: var(--tk-accent) !important; color: var(--tk-accent); }
.tk-head { pointer-events: none; position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--tk-accent); }
.tk-recording .tk-top, .tk-recording .tk-transport, .tk-recording .tk-timeline, .tk-recording .tk-pop, .tk-recording .tk-side { display: none; }
@media (max-width: 900px) { .tk-body { flex-direction: column; align-items: stretch; } .tk-side { width: auto; max-height: none; } }
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
  className = "",
  title = "",
  exportCommand,
  children,
}: {
  film: Film<S>;
  clock: Transport;
  /** A new take, a loop, or a seek back: put the world back as it was (rebuild anything a take broke). */
  onReset: () => void;
  /** Added to the root, to set the --tk-* variables (colors, --tk-font). */
  className?: string;
  /** The film's name, top left. */
  title?: string;
  /** What the Export button copies. Default: `npm run trailer:export -- <this page>` (the kit README, "Export"). */
  exportCommand?: string;
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
  const clockText = useRef<HTMLSpanElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const range = useRef<[number, number]>([0, LENGTH]);
  const [shownRange, setShownRange] = useState<[number, number]>([0, LENGTH]);
  const rec = useRef(false);
  const exporting = useRef(false);
  const [command, setCommand] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
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
      if (!on || clock.rate !== 1 || exporting.current) return a.pause();
      const go = () => {
        a.currentTime = (film.song?.offset ?? 0) + Math.max(0, beatOf(clock)) * BEAT;
        a.volume = 1;
        a.play().catch(() => {
          // no song file yet (tools/music.mjs): silent
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
  // Export mode: tools/export.mjs stops the page's clocks, calls start(), and
  // steps the film frame by frame. The sound is mixed from info(), so none plays here.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("export")) return;
    const w = window as unknown as { __gg?: unknown };
    w.__gg = {
      info: () => ({
        beat: film.beat,
        length: film.length,
        song: film.song ?? null,
        sounds: film.sounds,
      }),
      start: () => {
        exporting.current = true;
        rec.current = true;
        setRecording(true);
        setScene(null);
        setRange([0, LENGTH]);
        clock.speed(1);
        setRate(1);
        reset.current();
        setPlaying(true);
        clock.play(0);
      },
    };
    return () => {
      delete w.__gg;
    };
  }, [film, clock, LENGTH]);

  const exportFilm = () => {
    const url = window.location.origin + window.location.pathname;
    const cmd = exportCommand ?? `npm run trailer:export -- ${url}`;
    setHelp(false);
    setCommand(cmd);
    void navigator.clipboard?.writeText(cmd).catch(() => {
      // no clipboard (http, or denied): the command stays on screen to select
    });
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
      if (e.code === "Escape") {
        setHelp(false);
        setCommand(null);
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
      if (clock.held === null && clock.rate === 1 && beat > last && !exporting.current)
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
      if (head.current)
        head.current.style.left = `${(Math.min(LENGTH, Math.max(0, beat)) / LENGTH) * 100}%`;
      if (clockText.current) clockText.current.textContent = Math.max(0, beat * BEAT).toFixed(2);
      let k = 0;
      for (const x of film.flashes) {
        const since = (beat - x) * BEAT;
        if (since >= 0 && since < 0.25) k = Math.max(k, 0.55 * (1 - since / 0.25));
      }
      if (flash.current) flash.current.style.opacity = String(k);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, syncAudio, film, sfx, BEAT, LENGTH]);

  const [r0, r1] = shownRange;
  // The ruler scrubs the whole film; scrubbing out of a picked scene goes back to the film.
  const scrubTo = (e: PointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    const beat = Math.min(
      LENGTH - 0.001,
      Math.max(0, ((e.clientX - box.left) / box.width) * LENGTH),
    );
    const [a, b] = range.current;
    if (beat < a || beat >= b) {
      setScene(null);
      setRange([0, LENGTH]);
    }
    seek(beat, playing);
  };
  const pct = (beat: number) => `${(Math.max(0, beat) / LENGTH) * 100}%`;

  return (
    <main className={`tk-studio ${recording ? "tk-recording" : ""} ${className}`}>
      <style>{CSS}</style>
      <div className="tk-wrap">
        <header className="tk-top">
          <span className="tk-title">{title}</span>
          <div className="tk-actions">
            <button
              type="button"
              onClick={() => {
                setCommand(null);
                setHelp(!help);
              }}
              className={`tk-ghost ${help ? "tk-on" : ""}`}
              aria-label="Keys"
            >
              ?
            </button>
            <button type="button" onClick={record} className="tk-ghost tk-rec">
              ● Rec
            </button>
            <button type="button" onClick={exportFilm} className="tk-primary">
              Export mp4
            </button>
          </div>
        </header>

        {command && (
          <div className="tk-pop">
            <div className="tk-pop-head">
              <span>Copied · run it in the project</span>
              <button type="button" onClick={() => setCommand(null)} aria-label="Close">
                ×
              </button>
            </div>
            <code className="tk-cmd">{command}</code>
          </div>
        )}
        {help && (
          <div className="tk-pop">
            <dl className="tk-keys">
              {KEYS.map(([key, what]) => (
                <div key={key} style={{ display: "contents" }}>
                  <dt>{key}</dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="tk-body">
          <div className="tk-main">
            <div className="tk-stage">
              {children(frame)}
              <Titles cues={titles.map((i) => film.titles[i])} />
              <div ref={flash} className="tk-flash" />
            </div>

            <div className="tk-transport">
              <button type="button" onClick={toggle} className="tk-play">
                {playing ? "Pause" : "Play"}
              </button>
              <span className="tk-time">
                <b ref={clockText}>0.00</b> / {(LENGTH * BEAT).toFixed(2)}s
              </span>
              <div className="tk-rates">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => changeRate(r)}
                    className={rate === r ? "tk-on" : ""}
                  >
                    {String(r).replace(/^0/, "")}×
                  </button>
                ))}
              </div>
            </div>

            <div className="tk-timeline">
              <div
                ref={track}
                className="tk-ruler"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  scrubTo(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons) scrubTo(e);
                }}
              >
                {SCENES.slice(1).map((sc) => (
                  <div key={sc.name} className="tk-cut" style={{ left: pct(sc.start) }} />
                ))}
                {scene !== null && (
                  <div
                    className="tk-loop"
                    style={{ left: pct(r0), width: pct(r1 - Math.max(0, r0)) }}
                  />
                )}
              </div>
              <div ref={head} className="tk-head" />
            </div>
          </div>

          <nav className="tk-side" aria-label="Scenes">
            {[...SCENES.map((sc, i) => [sc, i] as const), [null, null] as const].map(([sc, i]) => (
              <button
                key={sc?.name ?? "film"}
                type="button"
                onClick={() => pick(i)}
                className={`tk-scene ${sc ? "" : "tk-all"} ${scene === i ? "tk-on" : ""}`}
              >
                <span>{sc ? `${i + 1}  ${sc.name}` : "Whole film"}</span>
                <span>{((sc ? sc.end - sc.start : LENGTH) * BEAT).toFixed(1)}s</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
