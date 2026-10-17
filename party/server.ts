import { routePartykitRequest } from "partyserver";
import { ArcadeServer } from "./arcade";
import type { Env } from "./room";

// ─── The parties' worker ────────────────────────────────────
// One Cloudflare Worker, one Durable Object class per party (wrangler.jsonc).
// Requests route to /parties/<binding, kebab-cased>/<room>, the same paths
// hosted PartyKit served, so clients only change host. The arcade ("main")
// checks the player's token before the socket reaches its room; the lobby
// takes no writes from outside.

export { ArcadeServer } from "./arcade";
export { LobbyServer } from "./lobby";
export { FlyServer } from "./fly";
export { DriveServer } from "./drive";
export { RaceServer } from "./race";
export { DriftServer } from "./drift";
export { TownLiveServer } from "./townlive";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const res = await routePartykitRequest(request, env as never, {
      onBeforeConnect: (req, { party }) => (party === "main" ? ArcadeServer.onBeforeConnect(req, env) : undefined),
      // The lobby's counts come from the arcade rooms inside this worker (room.party), never from outside.
      onBeforeRequest: (req, { party }) => (party === "lobby" && req.method === "POST" ? new Response("Forbidden", { status: 403 }) : undefined),
    });
    return res ?? new Response("Not found", { status: 404 });
  },
};

export default worker;
