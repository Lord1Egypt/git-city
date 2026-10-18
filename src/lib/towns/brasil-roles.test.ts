import { describe, expect, it } from "vitest";
import { brasilOffices, officeLabel } from "./brasil-roles";
import type { BrasilLayout, CityLayout } from "./brasil-map";

const dev = (login: string, uf: CityLayout["uf"]) => ({ dev: { id: login.length, login, uf }, x: 0, z: 0, founder: false, at: 0 });
const city = (name: string, uf: CityLayout["uf"], logins: string[], second = false) => ({ name, uf, second, devs: logins.map((l) => dev(l, uf)) }) as unknown as CityLayout;

const layout = {
  cities: [city("São Paulo", "SP", ["ana", "bia", "caio", "duda"]), city("Campinas", "SP", ["enzo"], true), city("Salvador", "BA", ["fabi"])],
  island: { devs: [dev("gus", null)] } as unknown as CityLayout,
  highways: [],
} as unknown as BrasilLayout;

describe("brasilOffices", () => {
  const totals = new Map([["ana", 50], ["bia", 90], ["caio", 10], ["duda", 0], ["enzo", 70], ["fabi", 200], ["gus", 300]]);
  const o = brasilOffices(layout, totals);
  it("elects the top dev of Brazil president, the island included", () => expect(o.president).toBe("gus"));
  it("each state's top dev governs and its top three sit in the Senate", () => {
    expect(o.governors.get("SP")).toBe("bia");
    expect(o.senators.get("SP")).toEqual(["bia", "enzo", "ana"]);
    expect(o.governors.get("BA")).toBe("fabi");
  });
  it("a second city has its own mayor; nobody who didn't code holds anything", () => {
    expect(o.mayors.get("Campinas")).toEqual({ login: "enzo", uf: "SP" });
    expect(o.mayors.get("São Paulo")?.login).toBe("bia");
    expect(o.byLogin.has("duda")).toBe(false);
    expect(o.byLogin.get("bia")?.map(officeLabel)).toEqual(["Governor of SP", "Senator for SP", "Mayor of São Paulo"]);
  });
});
