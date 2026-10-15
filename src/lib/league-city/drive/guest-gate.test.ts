import { describe, expect, it } from "vitest";
import { GATE_AGAIN_MS, GATE_FIRST_MS, STALL_MAX_MS, STALL_SPUTTER_MS, COUGHS, gateDueMs, stallDone, stallInput } from "./guest-gate";

describe("guest gate", () => {
  it("stops a guest after 30 s, then every minute more", () => {
    expect(gateDueMs(0)).toBe(GATE_FIRST_MS);
    expect(gateDueMs(1)).toBe(GATE_FIRST_MS + GATE_AGAIN_MS);
    expect(gateDueMs(2)).toBe(GATE_FIRST_MS + 2 * GATE_AGAIN_MS);
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

  it("opens the choice once stopped, or after a while regardless", () => {
    expect(stallDone(500, 0)).toBe(false);
    expect(stallDone(STALL_SPUTTER_MS + 10, 0.5)).toBe(true);
    expect(stallDone(3000, 20)).toBe(false);
    expect(stallDone(STALL_MAX_MS, 20)).toBe(true);
  });
});
