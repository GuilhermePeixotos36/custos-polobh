import { describe, expect, it } from "vitest";
import { linhasDosBancarios, meioDePagamento, prazoDePagamento, prazoParaDocumento } from "./pagamentoOs";
import type { Os } from "@/data/types";

const bancarios = (patch: Partial<Os["fornecedor"]["dadosBancarios"]> = {}) => ({
  tipoConta: "" as const, banco: "", agencia: "", conta: "", chavePix: "", ...patch,
});
const os = (fin: Partial<Os["financeiro"]>, banco = bancarios(), parcelas: Os["orcamento"]["parcelas"] = []) =>
  ({ financeiro: fin, fornecedor: { dadosBancarios: banco }, orcamento: { parcelas } }) as unknown as Os;

describe("pagamento no faturamento da OS", () => {
  it("a forma escolhida vale; sem escolha, conta preenchida é Dados bancários", () => {
    expect(meioDePagamento(os({ meioPagamento: "Boleto bancário" }, bancarios({ banco: "Itaú" })))).toBe("Boleto bancário");
    expect(meioDePagamento(os({}, bancarios({ chavePix: "11222333000181" })))).toBe("Dados bancários");
    expect(meioDePagamento(os({}))).toBe("");
  });

  it("o prazo novo vence o texto antigo; sem ele, o antigo continua valendo", () => {
    expect(prazoDePagamento(os({ prazoPagamento: "30 dias", formaPagamento: "À vista" }))).toBe("30 dias");
    expect(prazoDePagamento(os({ formaPagamento: "À vista" }))).toBe("À vista");
    // Apagar o prazo de propósito não ressuscita o texto antigo.
    expect(prazoDePagamento(os({ prazoPagamento: "", formaPagamento: "À vista" }))).toBe("");
  });

  it("no documento, as parcelas combinadas vão abaixo do prazo", () => {
    const texto = prazoParaDocumento(os({ prazoPagamento: "30 dias após a nota" }, bancarios(), [{ descricao: "Sinal", valor: 100, data: "2026-12-01" }]));
    expect(texto.split("\n")).toHaveLength(2);
    expect(texto).toContain("30 dias após a nota");
    expect(texto).toContain("1ª — Sinal — pagamento em");
  });

  it("os dados da conta saem um por linha, só os preenchidos", () => {
    expect(linhasDosBancarios(bancarios({ tipoConta: "PJ", banco: "Itaú", chavePix: "x@y.com" })))
      .toEqual(["Tipo de conta: PJ", "Banco: Itaú", "Chave Pix: x@y.com"]);
  });
});
