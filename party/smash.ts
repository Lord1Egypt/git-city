import type { Party } from "partykit/server";
import type { ServerMsg } from "../src/lib/league-city/drive/net";
import { FLAG_BOOST } from "../src/lib/league-city/drive/net";
import { M_TO_UNIT } from "../src/lib/league-city/drive/tuning";
import { SMASH, SmashStore, type DamageEntry, type SmashTarget } from "../src/lib/league-city/smash";
import {
  BLAST_BUILDINGS,
  BLAST_ROWS,
  BLAST_WINDOW_MS,
  CONTRIB_MS,
  FloorBudget,
  REBUILD_REACH,
  REBUILD_SPEED,
  SAVE_MS,
  SMASH_TOWNS,
  blastReaches,
  carReaches,
  toFootprint,
  type SmashMsg,
} from "../src/lib/league-city/smash-net";

// ─── Rivalry smash (drive room side) ────────────────────────
// The authority on a rivalry town's floors. Loads the town's buildings and
// saved damage from the site (/api/towns/[slug]/smash), learns who each driver
// is from their access token (/smash/me: only the other side may smash),
// checks every hit (near enough, a real blast, a floor budget), grows floors
// back (time, contributions, the owner parked against it) and sends each
// change to everyone. Saves go back to the site signed with the shared
// FORCE_PUSH_HMAC_SECRET every SAVE_MS, and at once when a building falls.

export interface SmashDriver {
  login: string | null;
  canSmash: boolean;
  budget: FloorBudget;
  /** Last floor taken per building column by this car (cooldown). */
  lastCol: Map<string, number>;
}

interface Blast {
  from: string;
  at: number;
  x: number;
  z: number;
  buildings: Set<string>;
}

type Where = (id: string) => { x: number; z: number; speed: number; flags: number } | null;

export class SmashRoom {
  private store: SmashStore | null = null;
  private loading: Promise<void> | null = null;
  /** Owners' week contributions as last seen (the base for growing floors back). */
  private contrib = new Map<string, number>();
  private dirty = new Set<string>();
  private fallen: { victim: string; attacker: string }[] = [];
  private blasts = new Map<number, Blast>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSave = 0;
  private lastContrib = 0;
  readonly drivers = new Map<string, SmashDriver>();

  constructor(
    private room: Party.Room,
    private where: Where,
  ) {}

  get enabled(): boolean {
    return SMASH_TOWNS.includes(this.room.id);
  }

  private env(key: string): string | undefined {
    return (this.room.env as Record<string, unknown>)[key] as string | undefined;
  }

  private site(): string | null {
    const url = this.env("SITE_URL");
    return url ? url.replace(/\/+$/, "") : null;
  }

  /** Loads the town once; later calls wait for the same load. */
  ensure(): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    this.loading ??= this.load().catch((err) => {
      console.error("[smash] load", err);
      this.loading = null;
    });
    return this.loading;
  }

  private async load() {
    const site = this.site();
    if (!site) return;
    const res = await fetch(`${site}/api/towns/${this.room.id}/smash`, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) throw new Error(`smash load ${res.status}`);
    const body = (await res.json()) as { targets: SmashTarget[]; damage: DamageEntry[] };
    const store = new SmashStore(body.targets);
    store.load(body.damage, Date.now());
    store.takeChanged();
    for (const d of body.damage) this.contrib.set(d.login, d.contribNow);
    this.store = store;
    this.lastContrib = Date.now();
    this.room.broadcast(JSON.stringify(this.all()));
    this.run();
  }

  /** Every damaged building, for a newcomer. */
  all(): ServerMsg {
    return { t: "damage_all", list: (this.store?.snapshot() ?? []).map((d) => [d.login, d.rows, d.demolishedBy]) };
  }

  /** Sends the damage to someone who just arrived (after the load, if it's still running). */
  async greet(conn: Party.Connection) {
    await this.ensure();
    if (this.store) conn.send(JSON.stringify(this.all()));
  }

  join(id: string) {
    this.drivers.set(id, { login: null, canSmash: false, budget: new FloorBudget(), lastCol: new Map() });
  }

  leave(id: string) {
    this.drivers.delete(id);
  }

  /** Asks the site who the token belongs to and tells the driver whether they may smash. */
  async auth(id: string, token: string, conn: Party.Connection) {
    const d = this.drivers.get(id);
    const site = this.site();
    if (!d || !site || !this.enabled) return;
    try {
      const res = await fetch(`${site}/api/towns/${this.room.id}/smash/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const me = (await res.json()) as { login: string; canSmash: boolean; home: boolean };
      d.login = me.login.toLowerCase();
      d.canSmash = me.canSmash === true;
      conn.send(JSON.stringify({ t: "smash_me", can: d.canSmash, home: me.home === true, login: d.login } satisfies ServerMsg));
    } catch (err) {
      console.error("[smash] auth", err);
    }
  }

  /** A blast was fired (the battle's `use`): it may break floors for a few seconds. */
  fired(fx: number, from: string, x: number, z: number) {
    if (!this.enabled) return;
    const now = Date.now();
    this.blasts.set(fx, { from, at: now, x, z, buildings: new Set() });
    for (const [k, b] of this.blasts) if (now - b.at > BLAST_WINDOW_MS) this.blasts.delete(k);
  }

  /** A driver's hit: checked, applied and sent to everyone. */
  smash(id: string, m: SmashMsg) {
    const store = this.store;
    const d = this.drivers.get(id);
    if (!store || !d?.canSmash || !d.login) return;
    const target = store.index.get(m.b);
    if (target === undefined || m.b === d.login) return;
    const now = Date.now();
    let columns: number[];
    let n: number;
    if (m.k === "car") {
      const car = this.where(id);
      if (!car || Math.abs(car.speed) < SMASH.minSpeed * 0.6) return;
      columns = carReaches(store, target, m.c, car.x, car.z).filter((c) => {
        const key = `${m.b}:${c}`;
        if (now - (d.lastCol.get(key) ?? 0) < SMASH.cooldownMs * 0.7) return false;
        d.lastCol.set(key, now);
        return true;
      });
      n = car.flags & FLAG_BOOST ? SMASH.boostRows : SMASH.rows;
    } else {
      const blast = this.blasts.get(m.fx ?? -1);
      if (!blast || blast.from !== id || now - blast.at > BLAST_WINDOW_MS) return;
      if (!blast.buildings.has(m.b) && blast.buildings.size >= BLAST_BUILDINGS) return;
      blast.buildings.add(m.b);
      columns = blastReaches(store, target, m.c, blast.x, blast.z);
      n = BLAST_ROWS;
    }
    const allowed = Math.floor(d.budget.take(columns.length * n, now) / n);
    columns = columns.slice(0, allowed);
    if (columns.length === 0) return;
    const { down } = store.hitColumns(target, columns, n, now, d.login);
    if (down) {
      this.fallen.push({ victim: m.b, attacker: d.login });
      this.lastSave = 0; // save (and email) now
    }
    this.flush();
  }

  /** Sends every changed building and marks it for the next save. */
  private flush() {
    const store = this.store;
    if (!store) return;
    for (const i of store.takeChanged()) {
      const login = store.targets[i].login;
      this.dirty.add(login);
      this.room.broadcast(JSON.stringify({ t: "damage", b: login, r: store.rowsOf(i), by: store.demolishedBy.get(i) ?? null } satisfies ServerMsg));
    }
  }

  /** Once a second while anyone is here: regrowth, owner rebuilds, saves, contributions. */
  private run() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const store = this.store;
      if (!store) return;
      const now = Date.now();
      store.frame(now, 1);
      for (const [id, d] of this.drivers) {
        if (!d.login) continue;
        const i = store.index.get(d.login);
        const car = this.where(id);
        if (i === undefined || !car || !store.isDamaged(i) || Math.abs(car.speed) > REBUILD_SPEED) continue;
        if (toFootprint(store, i, car.x * M_TO_UNIT, car.z * M_TO_UNIT) <= REBUILD_REACH) store.regrow(i, 1);
      }
      this.flush();
      if (now - this.lastContrib >= CONTRIB_MS) {
        this.lastContrib = now;
        void this.refreshContrib();
      }
      if (now - this.lastSave >= SAVE_MS && (this.dirty.size > 0 || this.fallen.length > 0)) {
        this.lastSave = now;
        void this.save();
      }
      if (this.room.getConnections && [...this.room.getConnections()].length === 0 && this.dirty.size === 0) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }

  /** Called when someone connects: keeps the clock going. */
  wake() {
    if (this.store) this.run();
  }

  /** Owners' new contributions grow their floors back. */
  private async refreshContrib() {
    const site = this.site();
    const store = this.store;
    if (!site || !store) return;
    try {
      const res = await fetch(`${site}/api/towns/${this.room.id}/smash?contrib=1`, { headers: { "cache-control": "no-cache" } });
      if (!res.ok) return;
      const { contrib } = (await res.json()) as { contrib: Record<string, number> };
      for (const [login, n] of Object.entries(contrib)) {
        const prev = this.contrib.get(login);
        this.contrib.set(login, n);
        const i = store.index.get(login);
        if (prev !== undefined && i !== undefined && n > prev) store.regrow(i, n - prev);
      }
      this.flush();
    } catch (err) {
      console.error("[smash] contrib", err);
    }
  }

  private async save() {
    const site = this.site();
    const secret = this.env("FORCE_PUSH_HMAC_SECRET");
    const store = this.store;
    if (!site || !secret || !store) return;
    const logins = [...this.dirty];
    const fallen = this.fallen.splice(0);
    this.dirty.clear();
    const rows = logins.flatMap((login) => {
      const i = store.index.get(login);
      if (i === undefined) return [];
      // -1: a building first hit this session; the site reads its owner's contributions as the base.
      return [{ login, rows: store.rowsOf(i), regenFrom: store.regenFrom(i), contribBase: this.contrib.get(login) ?? -1, demolishedBy: store.demolishedBy.get(i) ?? null }];
    });
    const body = JSON.stringify({ at: Date.now(), rows, demolished: fallen });
    try {
      const res = await fetch(`${site}/api/towns/${this.room.id}/smash`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smash-signature": await sign(secret, `${this.room.id}.${body}`) },
        body,
      });
      if (!res.ok) throw new Error(`smash save ${res.status}`);
    } catch (err) {
      console.error("[smash] save", err);
      for (const l of logins) this.dirty.add(l);
      this.fallen.unshift(...fallen);
    }
  }
}

async function sign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}
