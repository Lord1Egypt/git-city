import { describe, expect, it } from "vitest";
import { parseComment, replyFor } from "./brasil-comments";

describe("parseComment", () => {
  it.each([
    ["@srizzon SP", { login: "srizzon", uf: "SP" }],
    ["srizzon sp", { login: "srizzon", uf: "SP" }],
    ["SP @srizzon", { login: "srizzon", uf: "SP" }],
    ["github.com/srizzon - São Paulo", { login: "srizzon", uf: "SP" }],
    ["https://github.com/torvalds RJ", { login: "torvalds", uf: "RJ" }],
    ["sou de Recife PE @maria-dev", { login: "maria-dev", uf: "PE" }],
    ["@joao rio grande do sul", { login: "joao", uf: "RS" }],
    ["coloca eu aqui @ana-b, Minas Gerais", { login: "ana-b", uf: "MG" }],
    ["@pedro", { login: "pedro", uf: null }],
    ["Bahia!", { login: null, uf: "BA" }],
    ["top demais kkkk", { login: null, uf: null }],
    ["Slickinh0", { login: "slickinh0", uf: null }],
    ["Codyte ", { login: "codyte", uf: null }],
    ["top", { login: null, uf: null }],
    ["Incrível", { login: null, uf: null }],
    ["Brabo!!", { login: null, uf: null }],
    ["kkkkkk", { login: null, uf: null }],
    ["srizzon São Paulo", { login: "srizzon", uf: "SP" }],
    ["Codyte demais", { login: null, uf: null }],
  ])("%s", (text, want) => {
    expect(parseComment(text)).toEqual(want);
  });

  it("never takes a state's sigla for a username", () => {
    expect(parseComment("SP")).toEqual({ login: null, uf: "SP" });
    expect(parseComment("df @dev")).toEqual({ login: "dev", uf: "DF" });
  });

  it("refuses what can't be a GitHub login", () => {
    expect(parseComment("@-bad- SP").login).toBeNull();
    expect(parseComment("@nome_com_underscore SP").login).toBeNull();
  });
});

describe("replyFor", () => {
  it("speaks Portuguese and names the state, or the island", () => {
    expect(replyFor("added", "srizzon", "SP")).toContain("em São Paulo");
    expect(replyFor("added", "srizzon", null)).toContain("na ilha");
  });
  it("on a city reel, talks about the city", () => {
    expect(replyFor("added", "srizzon", null, "city")).toMatch(/Git City|cidade/);
    expect(replyFor("unknown_user", "x", null, "city")).toContain("GitHub");
  });
  it("never tags anyone: no @ before the login", () => {
    for (const o of ["added", "already", "unknown_user"]) for (const k of ["brasil", "city"] as const) expect(replyFor(o, "srizzon", "SP", k)).not.toContain("@");
  });
  it("words it differently for different logins, the same for one", () => {
    const lines = new Set(["a", "bb", "ccc", "dddd", "eeeee", "ffffff"].map((l) => replyFor("added", l, null, "city")!.replace(l, "")));
    expect(lines.size).toBeGreaterThan(1);
    expect(replyFor("added", "srizzon", "SP")).toBe(replyFor("added", "srizzon", "SP"));
  });
  it("stays quiet on comments without a username", () => {
    expect(replyFor("no_login", null, null)).toBeNull();
    expect(replyFor("blocked", "x", "SP")).toBeNull();
  });
});

describe("parseComment in a reply", () => {
  it("skips the account's own @ and the @ a reply starts with", () => {
    expect(parseComment("@samuelrizzondev Slickinh0", { ignore: ["samuelrizzondev"], reply: true }).login).toBe("slickinh0");
    expect(parseComment("@samuelrizzondev", { ignore: ["samuelrizzondev"] }).login).toBeNull();
    expect(parseComment("@amigo valeu", { reply: true }).login).toBeNull();
  });
  it("asks about a suggestion in the wording confirmedLogin reads back", () => {
    expect(replyFor("unknown_user", "slickinh0", null, "city", "slickinho")).toContain("É o slickinho?");
  });
});

describe("ptState", () => {
  it("puts the article Portuguese wants", async () => {
    const { ptState } = await import("./brasil-map");
    expect(ptState("AC", "the")).toBe("o Acre");
    expect(ptState("BA", "in")).toBe("na Bahia");
    expect(ptState("SP", "in")).toBe("em São Paulo");
    expect(ptState("RJ", "of")).toBe("do Rio de Janeiro");
    expect(replyFor("added", "srizzon", "AC")).toContain("no Acre");
  });
});
