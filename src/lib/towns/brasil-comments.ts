// ─── Brasil town: reading a comment ─────────────────────────
// What someone wrote under a reel, as the GitHub username and the state to
// put on the map. People write it every way: "@login SP", "login sp",
// "github.com/login - São Paulo", "SP: login", "sou de Recife PE @login".
// The username: a github.com/ link first, else the first @handle, else a
// bare word, when it's the whole comment, or when the comment also names a
// state and that word is the only thing it could be. The state: a UF on its own, or a state's name. An
// @handle may be an Instagram handle rather than a GitHub one; the importer
// checks GitHub before placing anyone. Pure.

import { STATES, parseUF, type UF } from "./brasil-map";

export interface ParsedComment {
  login: string | null;
  uf: UF | null;
}

/** A GitHub login: letters, digits and single hyphens, 39 at most, no hyphen at either end. */
const GITHUB_LOGIN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Words that are never a username in these comments (Portuguese and English filler, the ask itself). */
const NOT_LOGINS = new Set([
  "eu", "sou", "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "meu", "minha", "aqui", "estado", "cidade", "github", "user", "usuario",
  "me", "coloca", "coloque", "bota", "quero", "por", "favor", "pf", "pfv", "obrigado", "obrigada", "vlw", "valeu", "ai", "ae", "manda", "the", "my",
  "is", "from", "in", "im", "i", "am", "please", "add", "put", "here", "brasil", "brazil", "sim", "top", "show", "massa", "kkk", "kkkk", "haha",
  // Reactions people leave on their own, which would put a stranger called "brabo" on the map.
  "brabo", "braba", "foda", "parabens", "incrivel", "sensacional", "demais", "lindo", "perfeito", "amei", "genial", "insano", "mano", "cara",
  "nice", "wow", "cool", "great", "awesome", "insane", "amazing", "first", "primeiro", "link", "ok", "quero", "eu", "bora", "boa", "dahora",
]);
const LAUGH = /^(k{2,}|(ha){2,}h?|(rs){2,}|(he){2,})$/;

const STATE_NAMES: [string, UF][] = STATES.map((s) => [fold(s.name), s.uf] as [string, UF]).sort((a, b) => b[0].length - a[0].length);

export function parseComment(text: string): ParsedComment {
  const raw = text.trim();
  const lower = fold(raw);

  // The state: a full name first ("rio grande do sul" before "rio de janeiro" can't clash: longest first), else a UF word.
  let uf: UF | null = null;
  let rest = lower;
  for (const [name, code] of STATE_NAMES) {
    const at = rest.indexOf(name);
    if (at >= 0 && (at === 0 || /[^a-z0-9]/.test(rest[at - 1])) && (at + name.length === rest.length || /[^a-z0-9]/.test(rest[at + name.length]))) {
      uf = code;
      rest = rest.slice(0, at) + " " + rest.slice(at + name.length);
      break;
    }
  }

  // The username: a github.com link, else an @handle, else a plain word.
  let login: string | null = null;
  const link = /github\.com\/([a-z0-9-]+)/i.exec(rest);
  if (link && GITHUB_LOGIN.test(link[1].toLowerCase())) login = link[1].toLowerCase();
  const words = rest.replace(/github\.com\/[a-z0-9-]+/gi, " ").split(/[\s,;:|/()!?.]+/).filter(Boolean);
  if (!uf) {
    for (const w of words) {
      const code = parseUF(w.replace(/^@/, ""));
      if (code && w.length === 2) {
        uf = code;
        break;
      }
    }
  }
  if (!login) {
    const handle = words.find((w) => w.startsWith("@") && GITHUB_LOGIN.test(w.slice(1)));
    if (handle) login = handle.slice(1);
  }
  // A bare word counts when it's the whole comment ("srizzon": how most people answer), or next
  // to a state with nothing else it could be ("srizzon sp"), so a comment like "top demais" never
  // puts a stranger called "demais" on the map.
  if (!login && (uf || words.length === 1)) {
    // As written: a word typed with accents ("Incrível") was never a username.
    const typed = new Set(raw.toLowerCase().split(/[\s,;:|/()!?.]+/));
    const plain = words.filter((w) => typed.has(w) && GITHUB_LOGIN.test(w) && !NOT_LOGINS.has(w) && !LAUGH.test(w) && !(w.length === 2 && parseUF(w)) && !/^\d+$/.test(w));
    if (plain.length === 1) login = plain[0];
  }
  return { login, uf };
}

/**
 * The reply under a comment once it's imported, or null when it gets none (no
 * username: most comments are just comments; the rest would read as spam).
 */
export function replyFor(outcome: string, login: string | null, uf: UF | null, kind: "brasil" | "city" = "brasil"): string | null {
  if (kind === "city") {
    if (outcome === "added") return `Done! @${login} has a building in Git City now 🏙️ Link in bio to find it.`;
    if (outcome === "already") return `@${login} already has a building in Git City 🏙️ Link in bio to find it.`;
  }
  const where = uf ? `in ${STATES.find((s) => s.uf === uf)?.name ?? uf}` : "on the island";
  if (outcome === "added") return `Done! @${login} is on the Brasil map ${where} 🏙️ Link in bio to claim your building.`;
  if (outcome === "already") return `@${login} is already on the map. Link in bio to find your building 🏙️`;
  if (outcome === "unknown_user") return `Couldn't find @${login} on GitHub. Check the username and comment again.`;
  return null;
}
