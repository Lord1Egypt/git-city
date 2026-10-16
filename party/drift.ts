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

// ─── Drift spots ────────────────────────────────────────────
// One room per spot (room id = spot id). A relay: each driver says hello with
// a name, then streams its car; everyone else draws it as a see-through car
// with the name over it. No contact and no scores here: a run is still scored
// and checked by the site from its own frames. Names are display only.

interface Driver {
  name: string;
  state: number[] | null;
  lastState: number;
}

export class DriftServer extends PartyRoom {
  private drivers = new Map<string, Driver>();

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
  }

  onMessage(sender: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) return;
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
    const { t, name } = msg as Record<string, unknown>;
    if (t !== "hello" || !validName(name) || this.drivers.has(sender.id)) return;
    if (this.drivers.size >= MAX_DRIVERS) {
      sender.send(JSON.stringify({ t: "full" } satisfies ServerMsg));
      return;
    }
    this.drivers.set(sender.id, { name, state: null, lastState: 0 });
    this.room.broadcast(JSON.stringify({ t: "join", id: sender.id, name } satisfies ServerMsg), [sender.id]);
  }

  onClose(conn: Connection) {
    if (!this.drivers.delete(conn.id)) return;
    this.room.broadcast(JSON.stringify({ t: "leave", id: conn.id } satisfies ServerMsg));
  }
}

