import { describe, expect, it } from "vitest";
import { extrairMencoes } from "@/domain/mencoes";

const USUARIOS = ["Marisa M. Coelho", "GPX Automação (dev)", "José", "Ana", "Ana Paula"];

describe("menções @Nome", () => {
  it("reconhece nome simples e composto", () => {
    expect(extrairMencoes("@Ana veja isto", USUARIOS)).toEqual(["Ana"]);
    expect(extrairMencoes("oi @Marisa M. Coelho, pode ver?", USUARIOS)).toEqual(["Marisa M. Coelho"]);
  });

  it("reconhece nome que termina em parêntese ou em letra acentuada", () => {
    expect(extrairMencoes("@GPX Automação (dev) oi", USUARIOS)).toEqual(["GPX Automação (dev)"]);
    expect(extrairMencoes("@José confirma?", USUARIOS)).toEqual(["José"]);
    expect(extrairMencoes("fala com o @José", USUARIOS)).toEqual(["José"]);
  });

  it("prefere o nome mais longo e não casa pedaço de palavra", () => {
    expect(extrairMencoes("@Ana Paula e @Ana", USUARIOS)).toEqual(["Ana Paula", "Ana"]);
    expect(extrairMencoes("@Anastácia não é usuária", USUARIOS)).toEqual([]);
    expect(extrairMencoes("mande para contato@Ana2.com", USUARIOS)).toEqual([]);
  });
});
