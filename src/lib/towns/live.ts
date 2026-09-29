// Who's inside each town right now, for the /towns cards. Each town's drive
// room reports its own count to one tally room (party/townlive) when it
// changes, and /api/towns/live reads the tally in one request, so a town
// nobody is in costs nothing and reading costs the same for 10 towns or 10k.

export interface TownLive {
  driving: number;
  watching: number;
}

export interface LiveEntry extends TownLive {
  /** When the room last reported (ms). */
  at: number;
}

/** A room reports at most this often… */
export const REPORT_MIN_MS = 2_000;
/** …and says it's still there this often while anyone is in. */
export const HEARTBEAT_MS = 30_000;
/** A count this old is dropped: the room went away without saying so. */
export const LIVE_STALE_MS = 90_000;
/** Header the drive rooms sign their reports with (the tally room is reachable from the internet too). */
export const LIVE_SECRET_HEADER = "x-live-secret";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_COUNT = 100_000;

export function inTown(l: TownLive): number {
  return l.driving + l.watching;
}

const count = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT;

/** A drive room's report, or null when it isn't one. */
export function parseReport(body: unknown): ({ slug: string } & TownLive) | null {
  if (!body || typeof body !== "object") return null;
  const { slug, driving, watching } = body as Record<string, unknown>;
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || !count(driving) || !count(watching)) return null;
  return { slug, driving, watching };
}

/** Every town with someone in it and a fresh count, busiest first. */
export function liveSnapshot(entries: Map<string, LiveEntry>, now: number): Record<string, TownLive> {
  const out: Record<string, TownLive> = {};
  const fresh = [...entries].filter(([, e]) => now - e.at < LIVE_STALE_MS && inTown(e) > 0);
  fresh.sort((a, b) => inTown(b[1]) - inTown(a[1]));
  for (const [slug, e] of fresh) out[slug] = { driving: e.driving, watching: e.watching };
  return out;
}

/** Towns with people in them first (busiest first); the rest keep their order. */
export function sortByLive<T extends { slug: string }>(towns: T[], live: Record<string, TownLive | null | undefined>): T[] {
  const n = (t: T) => {
    const l = live[t.slug];
    return l ? inTown(l) : 0;
  };
  return towns
    .map((t, i) => ({ t, i, n: n(t) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.t);
}

/**
 * A drive room's side: call `update` on every join and leave; it sends a
 * changed count at most every REPORT_MIN_MS (the last one always goes out), a
 * zero right away, and repeats itself every HEARTBEAT_MS while anyone's in.
 */
export function createReporter(send: (live: TownLive) => void, now: () => number = Date.now) {
  let current: TownLive = { driving: 0, watching: 0 };
  let sent: TownLive = { driving: 0, watching: 0 };
  let sentAt = -Infinity;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const flush = () => {
    if (pending) clearTimeout(pending);
    pending = null;
    sent = { ...current };
    sentAt = now();
    send(sent);
    if (inTown(sent) > 0 && !heartbeat) heartbeat = setInterval(flush, HEARTBEAT_MS);
    if (inTown(sent) === 0 && heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  return {
    update(live: TownLive) {
      current = { ...live };
      if (current.driving === sent.driving && current.watching === sent.watching) {
        if (pending) clearTimeout(pending);
        pending = null;
        return;
      }
      // Empty: say so now, so a town doesn't look busy after everyone left.
      const wait = inTown(current) === 0 ? 0 : Math.max(0, sentAt + REPORT_MIN_MS - now());
      if (wait === 0) flush();
      else pending ??= setTimeout(flush, wait);
    },
  };
}
