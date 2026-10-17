import { describe, expect, it } from "vitest";
import { weekCrown, weekStart } from "./stats";
import type { BrasilLayout, CityLayout } from "@/lib/towns/brasil-map";

const dev = (uf: CityLayout["uf"], iso: string) => ({ dev: { id: 1, login: "x", uf }, x: 0, z: 0, founder: false, at: Date.parse(iso) });
const layout = (devs: ReturnType<typeof dev>[]) => ({ cities: [{ devs } as unknown as CityLayout], island: { devs: [] } as unknown as CityLayout, highways: [] }) as unknown as BrasilLayout;

describe("weekStart", () => {
  it("is Monday 00:00 in Brasília", () => {
    // Wed 2026-10-21 15:00 UTC → Monday 2026-10-19 03:00 UTC.
    expect(new Date(weekStart(Date.parse("2026-10-21T15:00:00Z"))).toISOString()).toBe("2026-10-19T03:00:00.000Z");
    // Monday 01:00 UTC is still Sunday in Brasília: the week before.
    expect(new Date(weekStart(Date.parse("2026-10-19T01:00:00Z"))).toISOString()).toBe("2026-10-12T03:00:00.000Z");
  });
});

describe("weekCrown", () => {
  it("crowns last full week's top gainer and names this week's leader", () => {
    const l = layout([dev("SP", "2026-10-20T12:00:00Z"), dev("BA", "2026-10-21T12:00:00Z"), dev("BA", "2026-10-22T12:00:00Z"), dev("MG", "2026-10-27T12:00:00Z")]);
    const { crown, leading } = weekCrown(l, Date.parse("2026-10-28T12:00:00Z"));
    expect(crown).toEqual({ uf: "BA", gained: 2 });
    expect(leading).toEqual({ uf: "MG", gained: 1 });
  });
  it("has no crown before a full week", () => {
    expect(weekCrown(layout([dev("SP", "2026-10-20T12:00:00Z")]), Date.parse("2026-10-21T12:00:00Z")).crown).toBeNull();
  });
});
