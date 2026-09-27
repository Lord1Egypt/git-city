import { describe, expect, it } from "vitest";
import { isRivalry, rivalOf, sideSwitch } from "./rivalry";

// Sunday 2026-09-27 12:00 UTC; its week started Monday 2026-09-21.
const SUNDAY = new Date("2026-09-27T12:00:00Z");
// Monday 2026-09-28 09:00 UTC: a new week.
const MONDAY = new Date("2026-09-28T09:00:00Z");
const LAST_WEEK = "2026-09-20T10:00:00Z";
const THIS_WEEK = "2026-09-23T10:00:00Z";
const THIS_MONDAY = "2026-09-28T08:00:00Z";

describe("rivalOf", () => {
  it("names the other side", () => {
    expect(rivalOf("claude-code-town")).toBe("codex-town");
    expect(rivalOf("codex-town")).toBe("claude-code-town");
  });
  it("is null outside the rivalry", () => {
    expect(rivalOf("brasil-town")).toBeNull();
    expect(isRivalry("brasil-town")).toBe(false);
  });
});

describe("sideSwitch", () => {
  it("does nothing when the dev was never on the other side", () => {
    expect(sideSwitch(null, SUNDAY)).toBe("none");
  });

  it("locks an active side mid-week, however old", () => {
    expect(sideSwitch({ status: "active", joined_at: THIS_WEEK }, SUNDAY)).toBe("locked");
    expect(sideSwitch({ status: "active", joined_at: LAST_WEEK }, SUNDAY)).toBe("locked");
  });

  it("switches an old side on Monday", () => {
    expect(sideSwitch({ status: "active", joined_at: LAST_WEEK }, MONDAY)).toBe("switch");
    expect(sideSwitch({ status: "active", joined_at: null }, MONDAY)).toBe("switch");
  });

  it("locks a side picked this Monday, even on Monday", () => {
    expect(sideSwitch({ status: "active", joined_at: THIS_MONDAY }, MONDAY)).toBe("locked");
  });

  it("locks leaving mid-week to pick the other side", () => {
    expect(sideSwitch({ status: "former", joined_at: LAST_WEEK, left_at: THIS_WEEK }, SUNDAY)).toBe("locked");
  });

  it("lets a dev who left before this week pick freely", () => {
    expect(sideSwitch({ status: "former", joined_at: LAST_WEEK, left_at: LAST_WEEK }, SUNDAY)).toBe("none");
  });

  it("on Monday, leaving an old side then picking the other is a switch", () => {
    expect(sideSwitch({ status: "former", joined_at: LAST_WEEK, left_at: THIS_MONDAY }, MONDAY)).toBe("none");
  });

  it("on Monday, a side both joined and left today still holds", () => {
    expect(sideSwitch({ status: "former", joined_at: THIS_MONDAY, left_at: THIS_MONDAY }, MONDAY)).toBe("locked");
  });

  it("frees a dev the admin removed", () => {
    expect(sideSwitch({ status: "former", joined_at: THIS_WEEK, left_at: THIS_WEEK, removed_by: 1 }, SUNDAY)).toBe("none");
  });
});
