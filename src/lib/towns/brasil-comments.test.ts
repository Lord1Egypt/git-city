import { describe, expect, it } from "vitest";
import { parseComment } from "./brasil-comments";

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
