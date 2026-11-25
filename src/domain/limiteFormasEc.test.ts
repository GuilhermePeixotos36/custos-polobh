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
  it("baixar o valor do item baixa a forma que ficaria acima dele", () => {
    const linha = { ...base, valorPolobh: 2150, valorSemBvComNf: 2150, valorSemBvSemNf: 1000 };
    const r = aplicarAlteracaoDeLinha(linha, { valorPolobh: 2125 });
    expect(r.valorSemBvComNf).toBe(2125);
    expect(r.valorSemBvSemNf).toBe(1000);
  });
  it("subir o valor do item não mexe nas formas", () => {
    const linha = { ...base, valorPolobh: 2000, valorSemBvComNf: 2000 };
    expect(aplicarAlteracaoDeLinha(linha, { valorPolobh: 2500 }).valorSemBvComNf).toBe(2000);
  });
});
