"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Volume1, Volume2, VolumeX, X } from "lucide-react";
import type { DriveCameraMode, DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { carColor, type DriverInfo } from "@/lib/league-city/drive/net";
import { HUD_BOX } from "../shared";
import PauseMenu, { CONTROLS } from "./PauseMenu";
import StartScreen from "./StartScreen";
import DrivePrompt, { type Lesson } from "./DrivePrompt";
import Dash from "./Dash";
import TouchControls from "./TouchControls";
import type { TouchDrive } from "@/lib/league-city/drive/touch";
import CrownPanel from "./CrownPanel";
import CopyLink from "./CopyLink";
import SmashNotice from "./SmashNotice";
import type { CrownState } from "@/lib/league-city/drive/crown";
import type { CityBuilding } from "@/lib/github";
import type { CityObject } from "@/lib/league-city/types";
import Minimap from "./Minimap";
import { ReactionBar, ReactionButton, ReactionLog } from "./Reactions";
import type { EmoteLogEntry } from "@/components/league/drive/EmoteBubbles";

// Drive mode HUD: the dash (bottom: item, speed, boost), camera, mute and exit
// (top right), prompts that teach each move when it's useful (DrivePrompt), a
// controls hint that fades after 6 s, the start screen while Rapier
// loads, and the pause menu. Speed and boost update from the telemetry object
// every animation frame without re-rendering.
// On the first drive, handed over by the town intro, there's no start screen
// (the intro loaded the car): one prompt teaches the controls and the rest of
// the HUD comes in piece by piece on your first move.
// On a phone (touchRef) the dash gives way to the touch controls
// (TouchControls), the corners get compact and the prompts speak touch.

const SEG = "flex items-center transition-colors hover:bg-white/5 [&>*]:transition-transform active:[&>*]:translate-y-px";
const ICON_BTN = `${SEG} w-10 justify-center py-2 text-cream hover:text-lime`;
const ICON = { size: 14, strokeWidth: 2.5 } as const;
/** First drive: the HUD comes in on its own after this long, even if you haven't moved. */
const ENTER_ANYWAY_MS = 8000;


export default function DriveHud({
  firstRun = false,
  touchRef,
  telemetry,
  ready,
  camera,
  muted,
  volume,
  paused,
  drivers,
  crown,
  map,
  emoteLog,
  onStartCrown,
  onVolume,
  onEmote,
  onResume,
  onCamera,
  onMute,
  onExit,
}: {
  /** Handed over by the town intro (see above). */
  firstRun?: boolean;
  /** Phone controls: the HUD writes them, the car reads them. */
  touchRef?: React.MutableRefObject<TouchDrive>;
  telemetry: DriveTelemetry;
  ready: boolean;
  camera: DriveCameraMode;
  muted: boolean;
  /** Master volume 0…1 (lib drive/volume). */
  volume: number;
  paused: boolean;
  /** Everyone else driving in this city right now. */
  drivers: DriverInfo[];
  /** Crown Rush state from the drive room. */
  crown: { crown: CrownState; offset: number; you: string | null } | null;
  /** What the minimap draws: the town, and your login (lowercase) for your building. */
  map: { buildings: CityBuilding[]; objects: CityObject[]; home: string | null };
  /** The room's last reactions, oldest first. */
  emoteLog: EmoteLogEntry[];
  onStartCrown: () => void;
  onVolume: (v: number) => void;
  /** A quick reaction (lib drive/emotes slot). */
  onEmote: (e: number) => void;
  onResume: () => void;
  onCamera: () => void;
  onMute: () => void;
  onExit: () => void;
}) {
  const honk = useRef<HTMLDivElement>(null);
  const honkName = useRef<HTMLSpanElement>(null);
  const [hints, setHints] = useState(true);
  // First drive: the HUD waits for your first move.
  const [entered, setEntered] = useState(!firstRun);
  const enter = firstRun ? (delay: number) => ({ animation: `fade-in 0.45s ease-out ${delay}s both` }) : () => undefined;

  useEffect(() => {
    if (entered) return;
    const t = setTimeout(() => setEntered(true), ENTER_ANYWAY_MS);
    return () => clearTimeout(t);
  }, [entered]);

  useEffect(() => {
    if (!ready || !entered) return;
    const t = setTimeout(() => setHints(false), 6000);
    return () => clearTimeout(t);
  }, [ready, entered]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (honk.current && honkName.current) {
        honk.current.dataset.on = String(!!telemetry.near);
        if (telemetry.near) honkName.current.textContent = `@${telemetry.near}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [telemetry]);

  const touch = !!touchRef;
  const silent = muted || volume === 0;
  // The prompt on screen: on a phone its button pulses (and the camera's gets a callout).
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const touchLesson = lesson === "boost" || lesson === "drift" || lesson === "attack" ? lesson : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 font-pixel uppercase">
      {/* First, so every other piece of the HUD sits above the steering layer. */}
      {ready && touchRef && <TouchControls touchRef={touchRef} telemetry={telemetry} lesson={touchLesson} />}

      {ready && entered && (
        <div className={`${HUD_BOX} absolute left-4 top-4 flex flex-col gap-1.5 px-3 py-2 text-[9px]`} style={enter(0)}>
          <p className="flex items-center gap-2 text-cream">
            <span className="h-1.5 w-1.5 animate-pulse bg-lime" aria-hidden />
            {drivers.length + 1} driving now
          </p>
          {touch ? null : drivers.length === 0 ? (
            <div className="flex max-w-[180px] flex-col items-start gap-1.5">
              <p className="text-dim normal-case">Share the link to race your team here.</p>
              <CopyLink />
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {drivers.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2" style={{ background: carColor(d.name) }} aria-hidden />
                  {d.name.startsWith("guest-") ? "guest" : `@${d.name}`}
                </li>
              ))}
              {drivers.length > 6 && <li className="text-dim">+{drivers.length - 6} more</li>}
            </ul>
          )}
        </div>
      )}

      {entered && (
        <div className={`${HUD_BOX} absolute right-4 top-4 flex items-stretch divide-x-2 divide-border`} style={enter(0.12)}>
          <span className="relative flex">
            <button
              type="button"
              onClick={onCamera}
              aria-label={camera === "chase" ? "Top-down camera (C)" : "Chase camera (C)"}
              title={camera === "chase" ? "Top-down camera (C)" : "Chase camera (C)"}
              // Phones: a word next to the icon, since there's no C key to learn it from.
              className={`${touch ? `${SEG} gap-2 px-3 py-2 text-[10px] text-cream` : ICON_BTN} ${touch && lesson === "camera" ? "animate-pulse bg-lime/20 text-lime" : ""}`}
            >
              <Camera {...ICON} aria-hidden />
              {touch && <span>View</span>}
            </button>
            {touch && lesson === "camera" && (
              <span
                role="status"
                className="pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 animate-[fade-in_0.3s_ease-out_both] whitespace-nowrap border-[3px] border-lime bg-bg px-3 py-2 text-[10px] text-cream"
              >
                {/* Caret up at the button */}
                <span className="absolute -top-[9px] left-1/2 -ml-[6px] border-x-[6px] border-b-[6px] border-x-transparent border-b-lime" aria-hidden />
                Tap to change the view
              </span>
            )}
          </span>
          {touch && <ReactionButton onEmote={onEmote} className={ICON_BTN} />}
          {/* Mute on click; the volume slider opens under it on hover or focus. */}
          <span className="group relative flex">
            <button
              type="button"
              onClick={onMute}
              aria-label={silent ? "Sound on" : "Mute"}
              aria-pressed={silent}
              title={silent ? "Sound on" : "Mute"}
              className={ICON_BTN}
            >
              {silent ? <VolumeX {...ICON} aria-hidden /> : volume < 0.5 ? <Volume1 {...ICON} aria-hidden /> : <Volume2 {...ICON} aria-hidden />}
            </button>
            {!touch && (
              // pt-2, not mt-2: the pointer crosses the gap without closing it.
              <span className="absolute right-[-3px] top-full hidden pt-2 group-focus-within:block group-hover:block">
                <label className={`${HUD_BOX} flex items-center gap-3 px-3 py-2.5 text-[9px] text-muted`}>
                  <span className="sr-only">Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((muted ? 0 : volume) * 100)}
                    onChange={(e) => onVolume(Number(e.target.value) / 100)}
                    className="h-1 w-28 cursor-pointer accent-lime"
                  />
                  <span className="w-7 text-right tabular-nums text-cream">{Math.round((muted ? 0 : volume) * 100)}</span>
                </label>
              </span>
            )}
          </span>
          <button type="button" onClick={onExit} className={`${SEG} gap-2 px-3 py-2 text-[10px] text-cream hover:text-lime`}>
            <X {...ICON} aria-hidden />
            <span>Exit</span>
          </button>
        </div>
      )}

      {ready && !touch && (
        <div
          ref={honk}
          data-on="false"
          className={`${HUD_BOX} absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-[10px] text-cream opacity-0 transition-opacity data-[on=true]:opacity-100`}
        >
          <span className="border-2 border-lime px-1.5 text-lime">H</span>
          Honk at <span ref={honkName} className="text-lime" />
        </div>
      )}

      {ready && entered && !touch && (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2" style={enter(0.2)}>
          <ReactionLog entries={emoteLog} />
          <ReactionBar on={!paused} onEmote={onEmote} />
          <Minimap telemetry={telemetry} buildings={map.buildings} objects={map.objects} home={map.home} size={150} />
        </div>
      )}
      {ready && entered && touch && (
        <div className="absolute left-4 top-[3.25rem]" style={enter(0.1)}>
          <Minimap telemetry={telemetry} buildings={map.buildings} objects={map.objects} home={map.home} size={92} />
        </div>
      )}

      {ready && entered && <SmashNotice telemetry={telemetry} />}

      {ready && entered && !touch && <Dash telemetry={telemetry} style={enter(0.24)} />}

      {ready && entered && !touch && (
        <div
          className={`absolute bottom-20 left-4 text-[9px] leading-loose text-muted transition-opacity duration-700 ${hints ? "opacity-100" : "opacity-0"}`}
        >
          {CONTROLS.map(([k, v]) => (
            <div key={k}>
              <span className="text-cream">{k}</span> {v}
            </div>
          ))}
          <div className="normal-case">Gamepad works too</div>
        </div>
      )}

      {ready && <DrivePrompt telemetry={telemetry} firstRun={firstRun} camera={camera} touchRef={touchRef} onDrive={() => setEntered(true)} onLesson={setLesson} />}

      {ready && entered && <CrownPanel crown={crown?.crown ?? null} offset={crown?.offset ?? 0} you={crown?.you ?? null} drivers={drivers} onStart={onStartCrown} />}

      {/* Last, so they blur and cover the rest of the HUD. */}
      {!firstRun && <StartScreen ready={ready} touch={touch} />}
      {paused && ready && (
        <PauseMenu camera={camera} muted={muted} onResume={onResume} onCamera={onCamera} onMute={onMute} onExit={onExit} />
      )}
    </div>
  );
}
