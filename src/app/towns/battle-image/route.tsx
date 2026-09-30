import { renderTownsBattleImage, type TownsBattleImage } from "@/lib/og/townsBattleImage";
import { getRivalryLogos, getWeekResult } from "@/lib/towns/battle";
import { battleWeekNumber } from "@/lib/towns/battle-rules";
import { BATTLE_START } from "@/lib/towns/rivalry";
import { isoDay } from "@/lib/leagues/scoring";

// The battle emails' hero. ?week=YYYY-MM-DD: that closed week's result; no
// week: the first battle week starting.
// ?sample=1: a made-up result for the email previews.
// A closed week never changes, so it's cached for good.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const week = q.get("week");

  const logos = await getRivalryLogos().catch(() => ({ claude: null, codex: null }));
  let data: TownsBattleImage;
  if (q.get("sample") === "1") {
    // Fixed numbers for the email previews (/admin/emails): no real week needed.
    data = { logos, kind: "result", week: 1, winner: "claude", claude: 84, codex: 61 };
  } else if (week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response("Bad week", { status: 400 });
    const r = await getWeekResult(week);
    if (!r) return new Response("Not found", { status: 404 });
    data = { logos, kind: "result", week: battleWeekNumber(week), winner: r.winner, claude: r.claude?.perDev ?? null, codex: r.codex?.perDev ?? null };
  } else {
    data = { logos, kind: "start", week: battleWeekNumber(isoDay(new Date(BATTLE_START))) };
  }
  const image = await renderTownsBattleImage(data);
  image.headers.set("Cache-Control", week ? "public, max-age=31536000, immutable" : "public, max-age=86400");
  return image;
}
