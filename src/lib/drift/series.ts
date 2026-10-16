// ─── Drift series ───────────────────────────────────────────
// A room with friends plays a series, Mario Kart's Grand Prix: three runs,
// points by place in each (10, 8, 6, 5, 4, 3, 2, 1), the most points wins.
// The host (whoever came first; the next one if they go) picks the spot and
// starts each run. Everyone in the room lines up, 3-2-1 together, and a run
// ends when everyone is through or SERIES.afterFirstMs after the first
// finish. Scores come from each driver's frames, checked by the party; the
// live score each client reports is only for the standings on screen.
//
// Pure: the party (party/drift.ts) owns one, the clients draw its view.
// Relative imports only (the party bundles this).

import type { SpotId } from "./spots/types";

export const SERIES = {
  rounds: 3,
  maxPlayers: 8,
  points: [10, 8, 6, 5, 4, 3, 2, 1],
  /** From start to GO: a beat for the message to land, then 3-2-1 (TRIAL.beats × beatMs). */
  leadMs: 1000,
  countdownMs: 3000,
  /** After the first driver crosses the line, the others have this long. */
  afterFirstMs: 30_000,
  /** No run lasts longer than this (frames.ts MAX_RUN_MS, and a little). */
  runCapMs: 245_000,
  /** A host who dropped (a reload, a spot change) keeps the room this long. */
  hostGraceMs: 15_000,
} as const;

export type SeriesPhase = "lobby" | "countdown" | "run" | "results" | "final";

export interface SeriesPlayer {
  login: string;
  joined: number;
  points: number;
  online: boolean;
  /** When they last dropped (ms), while offline. */
  leftAt: number;
}

export interface SeriesEntry {
  login: string;
  /** The checked score, or null: not through yet, or a run that didn't check out. */
  score: number | null;
  /** The score their client last reported (on-screen standings only). */
  live: number;
  done: boolean;
  /** Points this run gave them (results). */
  gained: number;
}

export interface Series {
  phase: SeriesPhase;
  /** The run under way or just played, 1-based; 0 before the first. */
  round: number;
  spot: SpotId;
  host: string | null;
  players: SeriesPlayer[];
  /** This run's drivers, in finishing order once it's over. */
  grid: SeriesEntry[];
  /** Server ms: GO, and when the run ends at the latest. */
  goAt: number;
  endsAt: number;
}

export function newSeries(spot: SpotId): Series {
  return { phase: "lobby", round: 0, spot, host: null, players: [], grid: [], goAt: 0, endsAt: 0 };
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const playerOf = (s: Series, login: string) => s.players.find((p) => same(p.login, login));
const entryOf = (s: Series, login: string) => s.grid.find((e) => same(e.login, login));
const isHost = (s: Series, login: string) => s.host !== null && same(s.host, login);
const between = (s: Series) => s.phase === "lobby" || s.phase === "results";

/** In, or back. False when the room is full. */
export function joinSeries(s: Series, login: string, now: number): boolean {
  const p = playerOf(s, login);
  if (p) {
    p.online = true;
    p.leftAt = 0;
    // Back mid-run (a reload): that run is lost, nobody waits on it.
    const e = entryOf(s, login);
    if (s.phase === "run" && e && !e.done) {
      e.done = true;
      endIfDone(s, now);
    }
  } else {
    if (s.players.filter((x) => x.online).length >= SERIES.maxPlayers) return false;
    s.players.push({ login, joined: now, points: 0, online: true, leftAt: 0 });
  }
  if (!s.host) s.host = login;
  return true;
}

/** Gone (for now): their points stay for the rest of the series. */
export function leaveSeries(s: Series, login: string, now: number) {
  const p = playerOf(s, login);
  if (!p) return;
  p.online = false;
  p.leftAt = now;
  if (s.phase === "run") endIfDone(s, now);
}

export function pickSpot(s: Series, login: string, spot: SpotId): boolean {
  if (!isHost(s, login) || !between(s) || s.spot === spot) return false;
  s.spot = spot;
  return true;
}

/** The host starts the next run (the first, or the one after the results). */
export function startRun(s: Series, login: string, now: number): boolean {
  if (!isHost(s, login) || !between(s) || s.round >= SERIES.rounds) return false;
  const drivers = s.players.filter((p) => p.online);
  if (drivers.length === 0) return false;
  s.round++;
  s.phase = "countdown";
  s.grid = drivers.map((p) => ({ login: p.login, score: null, live: 0, done: false, gained: 0 }));
  s.goAt = now + SERIES.leadMs + SERIES.countdownMs;
  s.endsAt = s.goAt + SERIES.runCapMs;
  return true;
}

/** After the last run's results: the final standings. */
export function finishSeries(s: Series, login: string): boolean {
  if (!isHost(s, login) || s.phase !== "results" || s.round < SERIES.rounds) return false;
  s.phase = "final";
  return true;
}

/** Same room, another series: points back to zero. */
export function rematch(s: Series, login: string): boolean {
  if (!isHost(s, login) || s.phase !== "final") return false;
  s.phase = "lobby";
  s.round = 0;
  s.grid = [];
  s.players = s.players.filter((p) => p.online);
  for (const p of s.players) p.points = 0;
  return true;
}

export function reportLive(s: Series, login: string, score: number) {
  const e = entryOf(s, login);
  if (s.phase === "run" && e && !e.done && Number.isFinite(score)) e.live = Math.max(0, Math.round(score));
}

/** Through the line: the checked score, or null when the run didn't check out (no points). */
export function finishRun(s: Series, login: string, score: number | null, now: number): boolean {
  const e = entryOf(s, login);
  if (s.phase !== "run" || !e || e.done) return false;
  e.done = true;
  e.score = score;
  if (score !== null) e.live = score;
  if (!s.grid.some((x) => x !== e && x.done)) s.endsAt = Math.min(s.endsAt, now + SERIES.afterFirstMs);
  endIfDone(s, now);
  return true;
}

function endIfDone(s: Series, now: number) {
  const waiting = s.grid.filter((e) => !e.done && playerOf(s, e.login)?.online);
  if (waiting.length === 0 || now >= s.endsAt) score(s);
}

/** Points by place; a tie shares the better place's points. No score, no points. */
function score(s: Series) {
  const ranked = s.grid.filter((e) => e.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const e of ranked) e.gained = SERIES.points[ranked.findIndex((x) => x.score === e.score)] ?? 0;
  const rest = s.grid.filter((e) => e.score === null);
  for (const e of rest) e.gained = 0;
  s.grid = [...ranked, ...rest];
  for (const e of s.grid) {
    const p = playerOf(s, e.login);
    if (p) p.points += e.gained;
  }
  s.phase = "results";
}

/** The clock: GO, the run's end, a host who didn't come back. True when anything changed. */
export function tickSeries(s: Series, now: number): boolean {
  let changed = false;
  if (s.phase === "countdown" && now >= s.goAt) {
    s.phase = "run";
    changed = true;
  }
  if (s.phase === "run" && now >= s.endsAt) {
    score(s);
    changed = true;
  }
  // Before the first run, whoever's been gone past the grace (not a reload, not a spot change) is out of the list.
  if (s.phase === "lobby" && s.round === 0) {
    const kept = s.players.filter((p) => p.online || now - p.leftAt < SERIES.hostGraceMs);
    if (kept.length !== s.players.length) {
      s.players = kept;
      changed = true;
    }
  }
  const host = s.host ? playerOf(s, s.host) : null;
  if (!host || (!host.online && now - host.leftAt >= SERIES.hostGraceMs)) {
    const next = s.players.filter((p) => p.online).sort((a, b) => a.joined - b.joined)[0] ?? null;
    const id = next?.login ?? null;
    if (id !== s.host) {
      s.host = id;
      changed = true;
    }
  }
  return changed;
}

/** Your place on the grid: the run's order once it's lined up, else the order you came in. */
export function slotOf(s: Series, login: string): number {
  const inGrid = s.grid.findIndex((e) => same(e.login, login));
  if ((s.phase === "countdown" || s.phase === "run") && inGrid >= 0) return inGrid;
  const i = s.players.filter((p) => p.online).findIndex((p) => same(p.login, login));
  return Math.max(0, i);
}

/** Anyone in the room right now. */
export const anyoneHere = (s: Series) => s.players.some((p) => p.online);

/** Everyone, most points first (then who came first). */
export function standings(s: Series): SeriesPlayer[] {
  return [...s.players].sort((a, b) => b.points - a.points || a.joined - b.joined);
}

export type ClientSeriesMsg =
  | { t: "spot"; spot: SpotId }
  | { t: "start" }
  | { t: "final" }
  | { t: "rematch" }
  | { t: "live"; score: number }
  | { t: "run"; frames: number[]; score: number };

export type ServerSeriesMsg =
  | { t: "series"; series: Series; now: number }
  /** Not let in: no seat (sign in), or the room is full. */
  | { t: "denied"; reason: "seat" | "full" };
