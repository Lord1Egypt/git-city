import { describe, expect, it } from "vitest";
import { confirmedLogin } from "./comment-ai";

const asked = [
  { who: "them" as const, text: "Slickinh0" },
  { who: "us" as const, text: 'Não achei o slickinh0 no GitHub 🤔 É o slickinho? Responde "sim" que eu coloco' },
];

describe("confirmedLogin", () => {
  it("takes a yes to our suggestion", () => {
    for (const yes of ["sim", "Sim!", "@samuelrizzondev sim", "isso", "👍", "é esse"]) expect(confirmedLogin(yes, "samuelrizzondev", asked)).toBe("slickinho");
  });
  it("ignores anything else, and a yes with no suggestion", () => {
    expect(confirmedLogin("não, é slickinh00", "samuelrizzondev", asked)).toBeNull();
    expect(confirmedLogin("sim", "samuelrizzondev", [{ who: "us", text: "Pronto! O prédio do codyte já tá na Git City" }])).toBeNull();
    expect(confirmedLogin("sim", "samuelrizzondev", [])).toBeNull();
  });
});
