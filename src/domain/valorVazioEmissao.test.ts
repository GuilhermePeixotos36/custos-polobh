import { describe, expect, it } from "vitest";
import { faltasParaEmitirOs, temValorDefinido } from "./calc";
import type { EcLinha } from "@/data/types";

const base = {
  statusAprovacao: "OK", fornecedorRazao: "Forn", fornecedorCnpj: "12.345.678/0001-90",
  valorPolobh: 0, valorCliente: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
  bv: { modo: "percentual", valor: 0, justificativa: "" }, valoresNaoAplicaveis: [],
} as unknown as EcLinha;

describe("valor vazio na emissão da OS", () => {
  it("avisa quando o item não tem valor nenhum", () => {
    expect(temValorDefinido(base)).toBe(false);
    expect(faltasParaEmitirOs(base, true)).toContain("Valor do item (está vazio)");
  });
  it("não avisa com algum valor, nem para quem não vê valores", () => {
    expect(faltasParaEmitirOs({ ...base, valorPolobh: 100 }, true)).not.toContain("Valor do item (está vazio)");
    expect(faltasParaEmitirOs(base, false)).not.toContain("Valor do item (está vazio)");
  });
});
