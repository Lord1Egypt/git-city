import { describe, expect, it } from "vitest";
import { pickTownOfWeek } from "./featured";

describe("pickTownOfWeek", () => {
  it("picks the top of the week's town ranking", () => {
    expect(pickTownOfWeek(["b", "a", "c"])).toBe("b");
  });

  it("lets last week's winner win again", () => {
    expect(pickTownOfWeek(["b", "a"], null)).toBe("b");
  });

  it("lets the staff pick win", () => {
    expect(pickTownOfWeek(["a"], "z")).toBe("z");
  });

  it("returns null when no town was ranked", () => {
    expect(pickTownOfWeek([])).toBeNull();
  });
});
