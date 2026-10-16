import { Server, getServerByName, type Connection } from "partyserver";
import type { DurableObjectNamespace, DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

// ─── PartyServer under the PartyKit shape ───────────────────
// The parties moved from hosted PartyKit (shut down Oct 2026) to PartyServer
// on Cloudflare. Each server still talks to `this.room` as it did there: its
// id, env, storage, broadcast and connections, and the other parties by name.
// Only the lifecycle hooks follow PartyServer (onMessage takes the connection
// first).

export type Env = Record<string, unknown>;

export interface Room {
  readonly id: string;
  readonly env: Env;
  readonly storage: DurableObjectStorage;
  broadcast(msg: string, without?: string[]): void;
  getConnection(id: string): Connection | undefined;
  getConnections(): Iterable<Connection>;
  /** A room of another party, by its binding ("Lobby", "Townlive"), to send an HTTP request to. */
  party(binding: string, name: string): { fetch(path: string, init?: RequestInit): Promise<Response> } | null;
}

export class PartyRoom extends Server<Env> {
  readonly room: Room;

  constructor(ctx: DurableObjectState, env: Env) {
    // partyserver types its base on `cloudflare:workers`; the state is the same object.
    super(ctx as never, env);
    const self = this;
    this.room = {
      get id() {
        return self.name;
      },
      env,
      storage: ctx.storage,
      broadcast: (msg, without) => self.broadcast(msg, without),
      getConnection: (id) => self.getConnection(id),
      getConnections: () => self.getConnections(),
      party: (binding, name) => {
        const ns = env[binding] as DurableObjectNamespace | undefined;
        if (!ns) return null;
        return {
          fetch: async (path, init) => {
            const stub = await getServerByName(ns as never, name);
            return (stub as unknown as { fetch(r: Request): Promise<Response> }).fetch(new Request(`https://party${path}`, init));
          },
        };
      },
    };
  }
}

export type { Connection, ConnectionContext } from "partyserver";
