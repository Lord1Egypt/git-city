import { describe, expect, it } from "vitest";
import { autoDrift, createTouch, dragSteer, mergeTouch, DRIFT_AFTER } from "./touch";
import type { DriveInput } from "./input";

const NONE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false, horn: false, camera: false, reset: false, fire: false };

describe("dragSteer", () => {
  it("steers by how far the finger moved, full lock at the range", () => {
    expect(dragSteer(200, 200, 400).steer).toBe(0);
    expect(dragSteer(200, 272, 400).steer).toBeCloseTo(1);
    expect(dragSteer(200, 164, 400).steer).toBeCloseTo(-0.5);
  });

  it("drags the origin along past full lock, so turning back answers at once", () => {
    const past = dragSteer(200, 400, 400);
    expect(past.steer).toBe(1);
    expect(past.origin).toBe(328);
    expect(dragSteer(past.origin, 364, 400).steer).toBeCloseTo(0.5);
  });
});

describe("autoDrift", () => {
  it("drifts after steering hard at speed for a moment, and ends when the steering eases", () => {
    let s = autoDrift(false, 0, 1, 10, DRIFT_AFTER / 2);
    expect(s.drift).toBe(false);
    s = autoDrift(s.drift, s.held, 1, 10, DRIFT_AFTER / 2 + 0.01);
    expect(s.drift).toBe(true);
    expect(autoDrift(true, s.held, 0.6, 10, 0.016).drift).toBe(true);
    expect(autoDrift(true, s.held, 0.1, 10, 0.016).drift).toBe(false);
  });

  it("never drifts when slow", () => {
    expect(autoDrift(false, 5, 1, 1, 1).drift).toBe(false);
  });
});

describe("mergeTouch", () => {
  it("leaves keys and pad alone when the touch controls are off", () => {
    expect(mergeTouch(NONE, { ...createTouch(), steer: 1 })).toEqual(NONE);
  });

  it("drives itself from the first touch, and stops on the brake", () => {
    const t = { ...createTouch(), on: true };
    expect(mergeTouch(NONE, t).throttle).toBe(0);
    expect(mergeTouch(NONE, { ...t, started: true }).throttle).toBe(1);
    const braking = mergeTouch(NONE, { ...t, started: true, brake: true });
    expect(braking.throttle).toBe(0);
    expect(braking.brake).toBe(1);
  });

  it("maps the buttons and the drag", () => {
    const m = mergeTouch(NONE, { ...createTouch(), on: true, started: true, steer: -0.4, drift: true, boost: true, fire: true, horn: true });
    expect(m).toMatchObject({ steer: -0.4, handbrake: true, boost: true, fire: true, horn: true });
  });
});
