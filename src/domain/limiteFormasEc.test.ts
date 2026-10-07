import { describe, expect, it } from "vitest";
import { aplicarAlteracaoDeLinha } from "./ec";
import type { EcLinha } from "@/data/types";

const base = { item: "Buffet", descricao: "Buffet", valorPolobh: 1000, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0 } as EcLinha;

describe("limite das formas de cobrança", () => {
  it("corta no valor definido do item", () => {
    expect(aplicarAlteracaoDeLinha(base, { valorComBvNf: 1500 }).valorComBvNf).toBe(1000);
    expect(aplicarAlteracaoDeLinha(base, { valorSemBvSemNf: 900 }).valorSemBvSemNf).toBe(900);
  });
  it("sem valor definido não há teto", () => {
    expect(aplicarAlteracaoDeLinha({ ...base, valorPolobh: 0 }, { valorSemBvComNf: 5000 }).valorSemBvComNf).toBe(5000);
  });
});
