import { describe, expect, it } from "vitest";
import {
  SERIES,
  finishRun,
  finishSeries,
  joinSeries,
  leaveSeries,
  newSeries,
  pickSpot,
  rematch,
  standings,
  startRun,
  tickSeries,
} from "./series";
import { roomCode, signSeat, verifySeat, CODE_RE } from "./ticket";

const GO = SERIES.leadMs + SERIES.countdownMs;

function room(...logins: string[]) {
  const s = newSeries("harbor");
  logins.forEach((l, i) => joinSeries(s, l, i));
  return s;
}

describe("drift series", () => {
  it("makes the first one in the host, and only the host starts or picks the spot", () => {
    const s = room("ana", "bo");
    expect(s.host).toBe("ana");
    expect(pickSpot(s, "bo", "touge")).toBe(false);
    expect(pickSpot(s, "ana", "touge")).toBe(true);
    expect(startRun(s, "bo", 100)).toBe(false);
    expect(startRun(s, "ana", 100)).toBe(true);
    expect(s.phase).toBe("countdown");
    expect(s.grid.map((e) => e.login)).toEqual(["ana", "bo"]);
  });

  it("goes live at GO and scores places when everyone is through", () => {
    const s = room("ana", "bo", "cy");
    startRun(s, "ana", 0);
    tickSeries(s, GO - 1);
    expect(s.phase).toBe("countdown");
    tickSeries(s, GO);
    expect(s.phase).toBe("run");
    finishRun(s, "bo", 9000, GO + 40_000);
    finishRun(s, "cy", null, GO + 41_000);
    expect(s.phase).toBe("run");
    finishRun(s, "ana", 12000, GO + 42_000);
    expect(s.phase).toBe("results");
    expect(s.grid.map((e) => [e.login, e.gained])).toEqual([
      ["ana", 10],
      ["bo", 8],
      ["cy", 0],
    ]);
    expect(standings(s).map((p) => p.points)).toEqual([10, 8, 0]);
  });

  it("ends the run a while after the first finish, and the stragglers get nothing", () => {
    const s = room("ana", "bo");
    startRun(s, "ana", 0);
    tickSeries(s, GO);
    finishRun(s, "ana", 5000, GO + 30_000);
    tickSeries(s, GO + 30_000 + SERIES.afterFirstMs - 1);
    expect(s.phase).toBe("run");
    tickSeries(s, GO + 30_000 + SERIES.afterFirstMs);
    expect(s.phase).toBe("results");
    expect(s.grid.find((e) => e.login === "bo")?.gained).toBe(0);
  });

  it("doesn't wait on someone who left mid-run", () => {
    const s = room("ana", "bo");
    startRun(s, "ana", 0);
    tickSeries(s, GO);
    finishRun(s, "ana", 5000, GO + 30_000);
    leaveSeries(s, "bo", GO + 31_000);
    expect(s.phase).toBe("results");
  });

  it("shares a tie's points", () => {
    const s = room("ana", "bo", "cy");
    startRun(s, "ana", 0);
    tickSeries(s, GO);
    finishRun(s, "ana", 100, GO);
    finishRun(s, "bo", 100, GO);
    finishRun(s, "cy", 50, GO);
    expect(s.grid.map((e) => e.gained)).toEqual([10, 10, 6]);
  });

  it("plays three runs, then the final, then a rematch from zero", () => {
    const s = room("ana", "bo");
    for (let r = 0; r < SERIES.rounds; r++) {
      const t = r * 1_000_000;
      expect(startRun(s, "ana", t)).toBe(true);
      tickSeries(s, t + GO);
      finishRun(s, "ana", 2, t + GO);
      finishRun(s, "bo", 1, t + GO);
    }
    expect(startRun(s, "ana", 9e6)).toBe(false);
    expect(finishSeries(s, "bo")).toBe(false);
    expect(finishSeries(s, "ana")).toBe(true);
    expect(standings(s)[0]).toMatchObject({ login: "ana", points: 30 });
    expect(rematch(s, "ana")).toBe(true);
    expect(s.round).toBe(0);
    expect(s.players.every((p) => p.points === 0)).toBe(true);
  });

  it("keeps the host through a quick reload, hands it on after the grace", () => {
    const s = room("ana", "bo");
    leaveSeries(s, "ana", 1000);
    // Before the first run a leaver is dropped: bo hosts at once.
    tickSeries(s, 1001);
    expect(s.host).toBe("bo");

    const t = room("ana", "bo");
    startRun(t, "ana", 0);
    tickSeries(t, GO);
    leaveSeries(t, "ana", GO + 10);
    tickSeries(t, GO + 10 + SERIES.hostGraceMs - 1);
    expect(t.host).toBe("ana");
    joinSeries(t, "ana", GO + 20);
    tickSeries(t, GO + 10 + SERIES.hostGraceMs + 1);
    expect(t.host).toBe("ana");
    leaveSeries(t, "ana", GO + 100);
    tickSeries(t, GO + 100 + SERIES.hostGraceMs);
    expect(t.host).toBe("bo");
  });

  it("caps the room", () => {
    const s = room(...Array.from({ length: SERIES.maxPlayers }, (_, i) => `p${i}`));
    expect(joinSeries(s, "late", 99)).toBe(false);
    expect(joinSeries(s, "p3", 99)).toBe(true);
  });
});

describe("drift seats", () => {
  const secret = "x".repeat(40);
  it("signs a seat the party can check, for that room only", async () => {
    const tok = await signSeat({ room: "r-ABCD", login: "ana", exp: 2000 }, secret);
    expect(await verifySeat(tok, secret, "r-ABCD", 1000)).toMatchObject({ login: "ana" });
    expect(await verifySeat(tok, secret, "r-WXYZ", 1000)).toBeNull();
    expect(await verifySeat(tok, secret, "r-ABCD", 3000)).toBeNull();
    expect(await verifySeat(tok, "y".repeat(40), "r-ABCD", 1000)).toBeNull();
    expect(await verifySeat(tok.slice(0, -2) + "AA", secret, "r-ABCD", 1000)).toBeNull();
  });
  it("makes codes without look-alikes", () => {
    for (let i = 0; i < 200; i++) expect(roomCode()).toMatch(CODE_RE);
  });
});
