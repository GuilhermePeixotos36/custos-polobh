import { describe, expect, it } from "vitest";
import { revisarOs } from "./revisaoOs";
import type { Os } from "@/data/types";

const os = (extra: Partial<Os> = {}) =>
  ({
    modalidade: "Locação", descritivo: "Palco", fornecedor: { nomeFantasia: "Casa", cnpj: "", razaoSocial: "", inscricaoEstadual: "", inscricaoMunicipal: "", dadosBancarios: {}, representante: "", telefone: "", email: "" },
    orcamento: { parcelas: [], documentoFiscal: "" }, financeiro: { valorAPagar: 0 }, cronograma: [], observacoesGerais: "",
    itens: [{ ecLinhaId: "l1", comBvNf: { naoSeAplica: false, valor: 100, justificativaBv: "" }, bv: { modo: "percentual", valor: 15 }, semBvComNf: { naoSeAplica: true, valor: 0 }, semBvSemNf: { naoSeAplica: true, valor: 0 } }],
    ...extra,
  }) as unknown as Os;

describe("revisar a OS", () => {
  it("não acusa nada quando nada mudou", () => {
    expect(revisarOs(os(), os(), () => "Palco").total).toBe(0);
  });

  it("aponta o descritivo e o valor do item que mudaram", () => {
    const depois = os({ descritivo: "Palco e som" });
    depois.itens[0].comBvNf.valor = 120;
    const r = revisarOs(os(), depois, () => "Palco");
    expect(r.gerais.map((g) => g.label)).toEqual(["Descritivo"]);
    expect(r.itens[0].titulo).toBe("Palco");
    expect(r.itens[0].campos.map((c) => c.label)).toContain("Valor com BV e NF");
  });

  it("OS ainda não gravada não tem com o que comparar", () => {
    expect(revisarOs(null, os(), () => "x").total).toBe(0);
  });
});
