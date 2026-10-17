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
 * The reply under a comment once it's imported, in Portuguese and in Sam's
 * voice (his reels are in Portuguese), or null when it gets none (no
 * username: most comments are just comments; the rest would read as spam).
 * The GitHub login goes without an @: on Instagram an @ tags whoever owns
 * that handle there. Each reply has a few wordings, picked by the login, so
 * a hundred replies don't read as one copied line.
 */
export function replyFor(outcome: string, login: string | null, uf: UF | null, kind: "brasil" | "city" = "brasil"): string | null {
  // FNV-1a over the login, so neighbouring logins land on different wordings.
  const hash = [...(login ?? "")].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const pick = (lines: string[]) => lines[hash % lines.length];
  const where = uf ? `em ${STATES.find((s) => s.uf === uf)?.name ?? uf}` : "na ilha";
  if (outcome === "unknown_user") return pick([`Não achei o ${login} no GitHub 😕 Confere o user e comenta de novo`, `Hmm, ${login} não existe no GitHub. Confere aí e manda de novo!`, `Não encontrei ${login} no GitHub 🤔 Vê se o user tá certinho e comenta de novo`]);
  if (kind === "city") {
    if (outcome === "added") return pick([`Pronto! O prédio do ${login} já tá na Git City 🏙️ Link na bio pra ver`, `Feito! ${login} já tem prédio na cidade 🏙️ Corre no link da bio`, `Tá na mão! Prédio do ${login} subiu na Git City 🏙️ Link na bio`]);
    if (outcome === "already") return pick([`O ${login} já tinha prédio na cidade! Link na bio pra achar 🏙️`, `${login} já tá na Git City faz tempo 😎 Link na bio pra ver teu prédio`, `Esse já tava lá! Prédio do ${login} no link da bio 🏙️`]);
    return null;
  }
  if (outcome === "added") return pick([`Pronto! ${login} tá no mapa ${where} 🏙️ Link na bio pra ver teu prédio`, `Feito! Prédio do ${login} subiu ${where} 🇧🇷 Corre no link da bio`, `Tá no mapa! ${login} agora mora ${where} 🏙️ Link na bio`]);
  if (outcome === "already") return pick([`O ${login} já tava no mapa! Link na bio pra achar teu prédio 🏙️`, `${login} já mora no mapa 😎 Link na bio pra ver`, `Esse já tava lá! Prédio do ${login} no link da bio 🇧🇷`]);
  return null;
}
