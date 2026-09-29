import { describe, expect, it } from "vitest";
import { GATE_AGAIN_MS, GATE_FIRST_MS, STALL_MAX_MS, STALL_SPUTTER_MS, COUGHS, gateCommand, gateDueMs, gateLines, stallDone, stallInput } from "./guest-gate";

describe("guest gate", () => {
  it("stops a guest after 90 s, then every 3 min more", () => {
    expect(gateDueMs(0)).toBe(GATE_FIRST_MS);
    expect(gateDueMs(1)).toBe(GATE_FIRST_MS + GATE_AGAIN_MS);
    expect(gateDueMs(2)).toBe(GATE_FIRST_MS + 2 * GATE_AGAIN_MS);
  });

  it("answers with git's real author error, naming the guest", () => {
    const lines = gateLines("time", 0, "guest-a3f2", 90_000).map((l) => l.text);
    expect(lines[0]).toBe("Author identity unknown");
    expect(lines).toContain("*** Please tell me who you are.");
    expect(lines).toContain("fatal: unable to auto-detect email address (got 'guest-a3f2@(none)')");
  });

  it("gets louder on later stops", () => {
    const second = gateLines("time", 1, "guest-a3f2", 4 * 60_000).map((l) => l.text);
    expect(second[0]).toBe("warning: 4 min of anonymous driving. nobody to git blame.");
    const third = gateLines("time", 2, "guest-a3f2", 7 * 60_000).map((l) => l.text);
    expect(third.some((t) => t.startsWith("hint: every building"))).toBe(true);
  });

  it("refuses to credit a crown win", () => {
    expect(gateCommand("crown", 0)).toBe('git commit -m "won crown rush"');
    expect(gateLines("crown", 0, "guest-a3f2", 0)[0].text).toBe("error: cannot credit win to guest-a3f2");
  });
});

describe("running out of gas", () => {
  const held = { throttle: 1, brake: 0, steer: 0.5, boost: true, handbrake: true, fire: true };

  it("coughs: the engine cuts out with a jerk, never boosts, and keeps the steering", () => {
    const on = stallInput(held, 100, 30);
    const cut = stallInput(held, COUGHS[0] + 20, 30);
    const afterJerk = stallInput(held, COUGHS[0] + 200, 30);
    expect(on).toMatchObject({ throttle: 1, brake: 0 });
    expect(cut).toMatchObject({ throttle: 0, brake: 0.5 });
    expect(afterJerk).toMatchObject({ throttle: 0, brake: 0 });
    expect([on, cut, afterJerk].every((b) => !b.boost && !b.handbrake && !b.fire && b.steer === 0.5)).toBe(true);
    expect(stallInput({ ...held, throttle: 0 }, 100, 30).throttle).toBe(0.6);
    expect(COUGHS.length).toBe(5);
  });

  it("then dies and brakes softly, but never into reverse", () => {
    expect(stallInput(held, STALL_SPUTTER_MS + 1000, 20)).toMatchObject({ throttle: 0 });
    expect(stallInput(held, STALL_SPUTTER_MS + 1000, 20).brake).toBeGreaterThan(0);
    expect(stallInput(held, STALL_SPUTTER_MS + 1000, 1).brake).toBe(0);
  });

  it("opens the terminal once stopped, or after a while regardless", () => {
    expect(stallDone(500, 0)).toBe(false);
    expect(stallDone(STALL_SPUTTER_MS + 10, 0.5)).toBe(true);
    expect(stallDone(3000, 20)).toBe(false);
    expect(stallDone(STALL_MAX_MS, 20)).toBe(true);
  });
});
