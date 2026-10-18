import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getPlayWeekRow: vi.fn(), sendNotification: vi.fn(), weekSmashes: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../towns/play-load", () => ({ getPlayWeekRow: m.getPlayWeekRow }));
vi.mock("../notifications", () => ({ sendNotification: m.sendNotification }));
vi.mock("./week-smashes", async (orig) => ({ ...(await orig<typeof import("./week-smashes")>()), weekSmashes: m.weekSmashes }));

import { renderBattleResultEmail, renderBattleStartEmail, sendBattleResults, type BattleResultEmailData } from "./towns-battle";
import { PREVIEW_LINKS } from "../email/previews/types";
import type { NotificationPayload } from "../notifications";
import type { PlayEntry, PlayWeekRow } from "../towns/play-score";

const HERO = "https://thegitcity.com/towns/battle-image?sample=1";
const RESULT: BattleResultEmailData = { week: 1, winner: "claude", claude: 120, codex: 95, side: "codex", mine: 412, heroUrl: HERO };
const FORBIDDEN = /per dev|coded|code this week/i;

describe("battle email copy", () => {
  it("starts with everything scoring", () => {
    expect(renderBattleStartEmail({ side: "claude", heroUrl: HERO }, PREVIEW_LINKS).preheader).toBe(
      "You're on Claude. Everything you do in Git City scores this week.",
    );
  });

  it("gives the reader's points", () => {
    expect(renderBattleResultEmail(RESULT, PREVIEW_LINKS).preheader).toBe("You scored 412 points for Codex.");
    expect(renderBattleResultEmail({ ...RESULT, mine: 1 }, PREVIEW_LINKS).preheader).toBe("You scored 1 point for Codex.");
  });

  it("says you didn't score when you have 0", () => {
    expect(renderBattleResultEmail({ ...RESULT, mine: 0 }, PREVIEW_LINKS).preheader).toBe("You didn't score for Codex that week.");
  });

  it("says who knocked you down and how many you knocked down, with a link to hit back", () => {
    const smash = { by: ["ana", "bo", "cy"], knocked: 1, hitBack: { login: "ana", slug: "codex" } };
    const r = renderBattleResultEmail({ ...RESULT, smash }, PREVIEW_LINKS);
    expect(r.text).toContain("@ana and 2 others knocked your building down last week. You knocked down 1 building.");
    expect(r.html).toContain("Hit @ana back");
    expect(r.html).toContain("/town/codex?drive=1&amp;at=ana");
  });

  it("leaves the smash line out when nothing fell", () => {
    expect(renderBattleResultEmail({ ...RESULT, smash: null }, PREVIEW_LINKS).text).not.toMatch(/knocked/);
    expect(renderBattleResultEmail({ ...RESULT, smash: { by: [], knocked: 2, hitBack: null } }, PREVIEW_LINKS).text).toContain(
      "You knocked down 2 buildings last week.",
    );
  });

  it("puts the score per player in the hero", () => {
    expect(renderBattleResultEmail(RESULT, PREVIEW_LINKS).html).toContain("Claude 120, Codex 95 per player");
  });

  it("never says contributions decide the war", () => {
    const renders = [
      renderBattleStartEmail({ side: "codex", heroUrl: HERO }, PREVIEW_LINKS),
      renderBattleResultEmail(RESULT, PREVIEW_LINKS),
      renderBattleResultEmail({ ...RESULT, side: "claude", mine: 131 }, PREVIEW_LINKS),
      renderBattleResultEmail({ ...RESULT, winner: null, mine: 0 }, PREVIEW_LINKS),
    ];
    for (const r of renders) {
      expect(r.subject).not.toMatch(FORBIDDEN);
      expect(r.html).not.toMatch(FORBIDDEN);
      expect(r.text).not.toMatch(FORBIDDEN);
    }
  });
});

// Task 7's shape: `daily` is points per day Mon..Sun, `days` is how many days scored.
function entry(id: number, side: PlayEntry["side"], total: number): PlayEntry {
  return {
    developer_id: id,
    login: `dev${id}`,
    avatar_url: null,
    side,
    total,
    daily: [total, 0, 0, 0, 0, 0, 0],
    days: total > 0 ? 1 : 0,
    counted: true,
  } as unknown as PlayEntry;
}

const ROW = {
  week_start: "2026-10-12",
  standings: [entry(1, "claude", 120), entry(2, "codex", 0), entry(3, null, 300)],
  war: {
    claude: { perPlayer: 95, scorers: 3, bonus: 25, score: 120 },
    codex: { perPlayer: 95, scorers: 3, bonus: 0, score: 95 },
    winner: "claude",
  },
} as unknown as PlayWeekRow;

describe("sendBattleResults", () => {
  beforeEach(() => {
    m.getPlayWeekRow.mockReset();
    m.sendNotification.mockReset();
    m.sendNotification.mockResolvedValue([{ channel: "email", success: true }]);
    m.weekSmashes.mockReset();
    m.weekSmashes.mockResolvedValue(new Map());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends nothing for a week before the season", async () => {
    expect(await sendBattleResults("2026-10-05")).toBe(0);
    expect(m.getPlayWeekRow).not.toHaveBeenCalled();
  });

  it("sends nothing when the play week didn't freeze", async () => {
    m.getPlayWeekRow.mockResolvedValue(null);
    expect(await sendBattleResults("2026-10-12")).toBe(0);
    expect(m.sendNotification).not.toHaveBeenCalled();
  });

  it("emails every player on a side from the frozen row, nobody outside the war", async () => {
    m.getPlayWeekRow.mockResolvedValue(ROW);
    expect(await sendBattleResults("2026-10-12")).toBe(2);
    const sent = m.sendNotification.mock.calls.map((c) => c[0] as NotificationPayload);
    expect(sent.map((p) => p.dedupKey)).toEqual(["battle_result:1:2026-10-12", "battle_result:2:2026-10-12"]);
    expect(sent.map((p) => p.title)).toEqual(["Claude won week 1", "Claude won week 1"]);
    expect(sent.map((p) => p.body)).toEqual(["You scored 120 points for Claude.", "You didn't score for Codex that week."]);
  });
});

describe("battle emails link the rules", () => {
  it("battle start has the rules link in html and text", () => {
    const e = renderBattleStartEmail({ side: "claude", heroUrl: "https://thegitcity.com/towns/battle-image" }, PREVIEW_LINKS);
    expect(e.html).toContain("/towns/rules?utm_source=email");
    expect(e.html).toContain("utm_campaign=battle_start");
    expect(e.html).toContain("How scoring and checks work");
    expect(e.text).toMatch(/How scoring and checks work: \S+\/towns\/rules\?\S*utm_campaign=battle_start/);
  });

  it("battle result has the rules link in html and text", () => {
    const e = renderBattleResultEmail(RESULT, PREVIEW_LINKS);
    expect(e.html).toContain("/towns/rules?utm_source=email");
    expect(e.html).toContain("utm_campaign=battle_result");
    expect(e.text).toMatch(/How scoring and checks work: \S+\/towns\/rules\?\S*utm_campaign=battle_result/);
  });
});
