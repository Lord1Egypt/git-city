import type { Party } from "partykit/server";
import { LIVE_SECRET_HEADER, liveSnapshot, parseReport, type LiveEntry } from "../src/lib/towns/live";

// ─── Town live tally ────────────────────────────────────────
// One room ("main") that knows who's inside every town: each town's drive room
// POSTs its count here when it changes (party/drive.ts), /api/towns/live GETs
// the whole list in one request. Counts live in memory and in storage, so the
// room waking up again still knows them; a count nobody refreshed in
// LIVE_STALE_MS is dropped (a room that went away without a word).
//
// Every party room is reachable from the internet, so a report must carry
// LIVE_SECRET; without it set, nothing is accepted.

export default class TownLiveServer implements Party.Server {
  options: Party.ServerOptions = { hibernate: true };

  private entries = new Map<string, LiveEntry>();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    const stored = await this.room.storage.list<LiveEntry>({ prefix: "t:" });
    for (const [key, e] of stored) this.entries.set(key.slice(2), e);
  }

  async onRequest(request: Party.Request) {
    if (request.method === "GET") {
      return Response.json(liveSnapshot(this.entries, Date.now()));
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const secret = (this.room.env.LIVE_SECRET as string | undefined)?.trim();
    if (!secret || request.headers.get(LIVE_SECRET_HEADER) !== secret) return new Response("Forbidden", { status: 403 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const report = parseReport(body);
    if (!report) return new Response("Bad request", { status: 400 });

    const { slug, driving, watching } = report;
    if (driving + watching === 0) {
      this.entries.delete(slug);
      await this.room.storage.delete(`t:${slug}`);
    } else {
      const entry = { driving, watching, at: Date.now() };
      this.entries.set(slug, entry);
      await this.room.storage.put(`t:${slug}`, entry);
    }
    return new Response("OK");
  }
}

TownLiveServer satisfies Party.Worker;
