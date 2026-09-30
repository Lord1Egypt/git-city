import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG } from "@/lib/og/devHero";
import { RIVALRY } from "@/lib/towns/rivalry";
import type { Side } from "@/lib/towns/battle-rules";

// The battle emails' hero (1200×630, the /towns card's language): the week
// that starts ("start") or the week that closed ("result").

const W = 1200;
const H = 630;
const M = 56;
const FOOTER_H = 78;
const GROUND_Y = H - FOOTER_H;
const [A, B] = RIVALRY;

/** Each town's pixel logo (the crab, the >_ cloud), or null: the name alone. */
export type TownLogos = Record<Side, string | null>;

export type TownsBattleImage = { logos: TownLogos } & (
  | { kind: "start"; week: number }
  | { kind: "result"; week: number; winner: Side | null; claude: number | null; codex: number | null }
);

function rgba(hex: string, a: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
}

const colorOf = (s: Side) => (s === "claude" ? A.color : B.color);
const nameOf = (s: Side) => (s === "claude" ? A.name : B.name).toUpperCase();
const score = (n: number | null) => (n === null ? "–" : String(n));

function frame(children: React.ReactNode) {
  const layer = { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "100%", display: "flex" };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: OG.bg, fontFamily: "Silkscreen", border: `6px solid ${OG.border}`, position: "relative", overflow: "hidden" }}>
      <div style={layer}>
        <div style={{ ...layer, backgroundImage: `linear-gradient(90deg, ${rgba(A.color, 0.14)} 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 55%, ${rgba(B.color, 0.14)} 100%)` }} />
        <div style={{ ...layer, backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />
        <div style={{ ...layer, backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px)", backgroundSize: "16px 16px" }} />
      </div>
      {children}
      <div style={{ position: "absolute", left: 0, top: GROUND_Y, width: W, height: 4, display: "flex" }}>
        <div style={{ display: "flex", width: W / 2, height: 4, backgroundColor: A.color }} />
        <div style={{ display: "flex", width: W / 2, height: 4, backgroundColor: B.color }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: GROUND_Y + 4, width: W, height: FOOTER_H - 4, backgroundColor: "#141418", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${M}px 13px` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 26, color: OG.cream }}>GIT</span>
          <span style={{ fontSize: 26, color: OG.accent }}>CITY</span>
        </div>
        <div style={{ display: "flex", fontSize: 16, color: OG.muted }}>THEGITCITY.COM/TOWNS</div>
      </div>
    </div>
  );
}

/** The result: each side's logo and name over its per dev, and the tug bar. */
function scoreboard(d: Extract<TownsBattleImage, { kind: "result" }>) {
  const [a, b] = [d.claude, d.codex];
  const share = a !== null && b !== null && a + b > 0 ? a / (a + b) : 0.5;
  return frame(
    <div style={{ position: "absolute", left: M, top: 56, width: W - 2 * M, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: 30, color: OG.muted, letterSpacing: 4 }}>{`WEEK ${d.week}`}</span>
      <div style={{ display: "flex", width: "100%", marginTop: 34, justifyContent: "space-between", alignItems: "flex-end" }}>
        {(["claude", "codex"] as const).map((s, i) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexDirection: i === 0 ? "row" : "row-reverse" }}>
              {d.logos[s] && (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={d.logos[s] as string} width={96} height={96} style={{ imageRendering: "pixelated" }} />
              )}
              <span style={{ fontSize: 44, color: colorOf(s), lineHeight: 1 }}>{nameOf(s)}</span>
            </div>
            <span style={{ fontSize: 150, color: colorOf(s), lineHeight: 1, marginTop: 18 }}>{score(i === 0 ? a : b)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", width: "100%", height: 20, marginTop: 26 }}>
        <div style={{ display: "flex", width: `${share * 100}%`, height: 20, backgroundColor: A.color }} />
        <div style={{ display: "flex", width: 4, height: 20, backgroundColor: OG.cream }} />
        <div style={{ display: "flex", flexGrow: 1, height: 20, backgroundColor: B.color }} />
      </div>
      <span style={{ marginTop: 24, fontSize: 36, color: OG.cream }}>
        {d.winner ? `${nameOf(d.winner)} WON · PER DEV` : "A TIE · PER DEV"}
      </span>
    </div>,
  );
}

function side(d: TownsBattleImage, s: Side) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
      {d.logos[s] ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={d.logos[s] as string} width={192} height={192} style={{ imageRendering: "pixelated" }} />
      ) : (
        <div style={{ display: "flex", width: 192, height: 192 }} />
      )}
      <span style={{ marginTop: 20, fontSize: 44, color: colorOf(s), lineHeight: 1 }}>{nameOf(s)}</span>
    </div>
  );
}

/** The week starting: both logos big, VS between them, the bar even. */
function kickoff(d: TownsBattleImage) {
  return frame(
    <div style={{ position: "absolute", left: M, top: 56, width: W - 2 * M, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: 30, color: OG.muted, letterSpacing: 4 }}>{`WEEK ${d.week}`}</span>
      <div style={{ display: "flex", width: "100%", marginTop: 34, justifyContent: "space-between", alignItems: "center" }}>
        {side(d, "claude")}
        <span style={{ fontSize: 40, color: OG.dim }}>VS</span>
        {side(d, "codex")}
      </div>
      <div style={{ display: "flex", width: "100%", height: 20, marginTop: 30 }}>
        <div style={{ display: "flex", width: "50%", height: 20, backgroundColor: A.color }} />
        <div style={{ display: "flex", width: 4, height: 20, backgroundColor: OG.cream }} />
        <div style={{ display: "flex", flexGrow: 1, height: 20, backgroundColor: B.color }} />
      </div>
      <span style={{ marginTop: 24, fontSize: 36, color: OG.cream }}>IT COUNTS FROM TODAY</span>
    </div>,
  );
}

export async function renderTownsBattleImage(d: TownsBattleImage): Promise<ImageResponse> {
  const font = await readFile(join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf"));
  return new ImageResponse(d.kind === "start" ? kickoff(d) : scoreboard(d), {
    width: W,
    height: H,
    fonts: [{ name: "Silkscreen", data: font, style: "normal", weight: 400 }],
  });
}
