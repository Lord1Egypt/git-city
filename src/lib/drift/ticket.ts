// ─── Drift room seats ───────────────────────────────────────
// A room with friends (/drift/r/<code>) is for GitHub logins only. The page
// signs a seat for the signed-in viewer with the shared FORCE_PUSH_HMAC_SECRET;
// the drift party (party/drift.ts) checks it before the login joins the
// series, so nobody plays under someone else's name. Web Crypto only, so the
// site and the worker share this file (relative imports only).
//
// Format: `seat1.<payload-base64url>.<sig-base64url>`

export const SEAT_VERSION = "seat1";
/** A seat outlives a long evening of series. */
export const SEAT_TTL_MS = 12 * 60 * 60 * 1000;

export interface Seat {
  /** The party room: `r-<code>`. */
  room: string;
  /** GitHub login as the site knows it. */
  login: string;
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const key = (secret: string, use: "sign" | "verify") =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [use]);

export async function signSeat(seat: Seat, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(seat)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret, "sign"), enc.encode(`${SEAT_VERSION}.${body}`)));
  return `${SEAT_VERSION}.${body}.${b64url(sig)}`;
}

/** The seat, when the token is ours, unexpired and for this room. */
export async function verifySeat(token: unknown, secret: string, room: string, now = Date.now()): Promise<Seat | null> {
  if (typeof token !== "string" || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SEAT_VERSION) return null;
  const [, body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret, "verify"), unb64url(sig), enc.encode(`${SEAT_VERSION}.${body}`));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64url(body))) as Seat;
    if (!s || typeof s.login !== "string" || typeof s.room !== "string" || typeof s.exp !== "number") return null;
    if (s.room !== room || s.exp < now) return null;
    return s;
  } catch {
    return null;
  }
}

const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

/** A room code: four letters and digits, none you'd mix up (no I, O, 0, 1). */
export function roomCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ABC[Math.floor(random() * CODE_ABC.length)];
  return s;
}

export const roomId = (code: string) => `r-${code}`;
