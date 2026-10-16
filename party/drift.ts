import { PartyRoom, type Connection } from "./room";
import {
  MAX_DRIVERS,
  MAX_MESSAGE_BYTES,
  SEND_MS,
  decodeState,
  encodeState,
  validName,
  type ServerMsg,
} from "../src/lib/league-city/drive/net";
import { courseOf, getLiveSpot } from "../src/lib/drift/spots";
import type { SpotId } from "../src/lib/drift/spots/types";
import { validateRun } from "../src/lib/drift/validate";
import {
  SERIES,
  anyoneHere,
  finishRun,
  finishSeries,
  joinSeries,
  leaveSeries,
  newSeries,
  pickSpot,
  rematch,
  reportLive,
  startRun,
  tickSeries,
  type ServerSeriesMsg,
} from "../src/lib/drift/series";
import { verifySeat } from "../src/lib/drift/ticket";

// ─── Drift spots and rooms ──────────────────────────────────
// A spot's room (room id = spot id) is a relay: each driver says hello with a
// name, then streams its car; everyone else draws it as a see-through car
// with the name over it. No contact and no scores: a run is scored and
// checked by the site from its own frames. Names are display only.
//
// A room with friends (room id = r-<code>) is the same relay plus a series
// (src/lib/drift/series.ts): GitHub logins only, each with a seat the page
// signed (ticket.ts). The host picks the spot and starts each run; each
// driver's frames come here at the line and are checked like the board
// checks them before they score.

interface Driver {
  name: string;
  state: number[] | null;
  lastState: number;
  lastLive: number;
}

/** A run's frames: four minutes at most (frames.ts), ~19k numbers. */
const MAX_RUN_BYTES = 400_000;
const LIVE_MIN_MS = 400;
/** How late the frames may come after the time they cover (ms): the trip, a slow tab. */
const RUN_SLACK_MS = 5000;

export class DriftServer extends PartyRoom {
  private drivers = new Map<string, Driver>();
  private series = newSeries("harbor");
  private clock: ReturnType<typeof setInterval> | null = null;

  private get isRoom() {
    return this.room.id.startsWith("r-");
  }

  private sendSeries(to?: Connection) {
    const msg = JSON.stringify({ t: "series", series: this.series, now: Date.now() } satisfies ServerSeriesMsg);
    if (to) to.send(msg);
    else this.room.broadcast(msg);
  }

  private online(login: string): boolean {
    return [...this.drivers.values()].some((d) => d.name.toLowerCase() === login.toLowerCase());
  }

  /** Ticks while a run is on or someone just dropped (the host's grace); twice a second for the standings. Never in an empty room. */
  private runClock() {
    if (this.clock) return;
    let last = 0;
    this.clock = setInterval(() => {
      const now = Date.now();
      const changed = tickSeries(this.series, now);
      const live = this.series.phase === "run" || this.series.phase === "countdown";
      if (changed || (live && now - last >= 500)) {
        last = now;
        this.sendSeries();
      }
      const recent = this.series.players.some((p) => !p.online && now - p.leftAt < SERIES.hostGraceMs + 1000);
      if (((!live && !recent) || !anyoneHere(this.series)) && this.clock) {
        clearInterval(this.clock);
        this.clock = null;
      }
    }, 250);
  }

  onConnect(conn: Connection) {
    const welcome = {
      t: "welcome",
      you: conn.id,
      drivers: [...this.drivers.entries()].map(([id, d]) => ({ id, name: d.name, s: d.state })),
      boxes: [],
      crown: null,
      now: Date.now(),
    };
    conn.send(JSON.stringify(welcome));
    if (this.isRoom) this.sendSeries(conn);
  }

  private seat(sender: Connection, name: string): boolean {
    if (this.drivers.size >= MAX_DRIVERS) {
      sender.send(JSON.stringify({ t: "full" } satisfies ServerMsg));
      return false;
    }
    this.drivers.set(sender.id, { name, state: null, lastState: 0, lastLive: 0 });
    this.room.broadcast(JSON.stringify({ t: "join", id: sender.id, name } satisfies ServerMsg), [sender.id]);
    return true;
  }

  private async seatInRoom(sender: Connection, name: string, token: unknown) {
    const secret = this.room.env.FORCE_PUSH_HMAC_SECRET as string | undefined;
    const seat = secret && secret.length >= 32 ? await verifySeat(token, secret, this.room.id) : null;
    if (!seat || seat.login.toLowerCase() !== name.toLowerCase()) {
      sender.send(JSON.stringify({ t: "denied", reason: "seat" } satisfies ServerSeriesMsg));
      return;
    }
    if (!this.room.getConnection(sender.id) || this.drivers.has(sender.id)) return;
    const now = Date.now();
    // An empty room's clock stood still: catch up first (a run nobody finished, a host long gone).
    tickSeries(this.series, now);
    if (!joinSeries(this.series, seat.login, now)) {
      sender.send(JSON.stringify({ t: "denied", reason: "full" } satisfies ServerSeriesMsg));
      return;
    }
    tickSeries(this.series, now);
    if (this.seat(sender, seat.login)) this.sendSeries();
    this.runClock();
  }

  private onRun(d: Driver, frames: unknown, claimed: unknown) {
    const s = this.series;
    const spot = getLiveSpot(s.spot);
    const now = Date.now();
    if (!spot || s.phase !== "run") return;
    const check = validateRun(courseOf(spot), frames, claimed, spot.minMs);
    if (!check.ok) console.warn(`[drift] ${this.room.id}: ${d.name}'s run rejected (${check.reason})`);
    // The frames can't cover more time than the run has been going.
    const score = check.ok && check.ms <= now - s.goAt + RUN_SLACK_MS ? check.score : null;
    if (finishRun(s, d.name, score, now)) this.sendSeries();
  }

  private onSeries(d: Driver, msg: Record<string, unknown>) {
    const s = this.series;
    const now = Date.now();
    if (msg.t === "live" && typeof msg.score === "number") {
      if (now - d.lastLive < LIVE_MIN_MS) return;
      d.lastLive = now;
      reportLive(s, d.name, msg.score);
      return;
    }
    if (msg.t === "run") return this.onRun(d, msg.frames, msg.score);
    let changed = false;
    if (msg.t === "spot" && typeof msg.spot === "string" && getLiveSpot(msg.spot)) changed = pickSpot(s, d.name, msg.spot as SpotId);
    else if (msg.t === "start") changed = startRun(s, d.name, now);
    else if (msg.t === "final") changed = finishSeries(s, d.name);
    else if (msg.t === "rematch") changed = rematch(s, d.name);
    if (!changed) return;
    this.sendSeries();
    if (s.phase === "countdown") this.runClock();
  }

  onMessage(sender: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    if (typeof message !== "string") return;
    const big = this.isRoom && message.length <= MAX_RUN_BYTES && message.startsWith('{"t":"run"');
    if (message.length > MAX_MESSAGE_BYTES && !big) return;
    let msg: unknown;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    if (Array.isArray(msg)) {
      const d = this.drivers.get(sender.id);
      if (!d || msg[0] !== "s") return;
      const now = Date.now();
      if (now - d.lastState < SEND_MS * 0.6) return;
      const s = decodeState(msg.slice(1));
      if (!s) return;
      d.lastState = now;
      d.state = encodeState(s);
      this.room.broadcast(JSON.stringify(["s", sender.id, ...d.state]), [sender.id]);
      return;
    }

    if (!msg || typeof msg !== "object") return;
    const m = msg as Record<string, unknown>;
    const d = this.drivers.get(sender.id);
    if (d && this.isRoom) return this.onSeries(d, m);
    if (m.t !== "hello" || !validName(m.name) || d) return;
    if (!this.isRoom) {
      this.seat(sender, m.name);
      return;
    }
    if (m.name.startsWith("guest-")) {
      sender.send(JSON.stringify({ t: "denied", reason: "seat" } satisfies ServerSeriesMsg));
      return;
    }
    void this.seatInRoom(sender, m.name, m.seat);
  }

  onClose(conn: Connection) {
    const d = this.drivers.get(conn.id);
    if (!d) return;
    this.drivers.delete(conn.id);
    this.room.broadcast(JSON.stringify({ t: "leave", id: conn.id } satisfies ServerMsg));
    if (!this.isRoom || this.online(d.name)) return;
    leaveSeries(this.series, d.name, Date.now());
    this.sendSeries();
    this.runClock();
  }
}
