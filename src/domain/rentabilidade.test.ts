import { describe, expect, it } from "vitest";
import { calcularRentabilidade } from "./rentabilidade";
import type { Ec, EcLinha } from "@/data/types";

const producaoZero = {
  despesasOperacionais: 0, equipeBH: 0, equipeViagem: 0, transporteBH: 0,
  transporteViagem: 0, alimentacaoBH: 0, alimentacaoViagem: 0,
  qtdDespesas: 0, qtdEquipeBH: 0, qtdEquipeViagem: 0, qtdTransporteBH: 0,
  qtdTransporteViagem: 0, qtdAlimentacaoBH: 0, qtdAlimentacaoViagem: 0,
};

function linha(p: Partial<EcLinha>): EcLinha {
  return {
    id: "l1", grupo: "CENOGRAFIA", item: "Palco", descricao: "", descricaoCompleta: "",
    valorPolobh: 0, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [],
    bv: { modo: "percentual", valor: 0, justificativa: "" },
    statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "",
    statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0,
    ...p,
  } as EcLinha;
}

const ec = (linhas: EcLinha[], extra: Partial<Ec> = {}): Ec =>
  ({ id: "ec1", numero: "EC-01", linhas, producao: producaoZero, ...extra }) as Ec;

describe("rentabilidade — a tabela que a Pólobh lê", () => {
  it("compara o que a EC cobrou com o que saiu pelas OSs", () => {
    const r = calcularRentabilidade(ec([linha({ valorPolobh: 10_000 })]), { l1: 8_000 });
    const item = r.linhas.find((l) => l.origem === "item")!;
    expect(item.valorEc).toBe(10_000);
    expect(item.valorLiquidoOs).toBe(8_000);
    expect(item.percent).toBeCloseTo(0.2);
  });

  // Honorários e encargos estão no total da EC: sem eles, a soma da tabela não
  // batia com o documento — era a queixa que originou o pedido.
  it("honorários e encargos entram como linha", () => {
    const r = calcularRentabilidade(ec([linha({ valorPolobh: 10_000 })]), {});
    const origens = r.linhas.map((l) => l.origem);
    expect(origens).toContain("honorarios");
    expect(origens).toContain("encargos");
    // 10.000 + 15% de honorários + 16,33% de encargos.
    expect(r.totalEc).toBeCloseTo(13_133, 0);
  });

  it("honorário é margem (não tem gasto contra ele) e encargo é custo", () => {
    const r = calcularRentabilidade(ec([linha({ valorPolobh: 10_000 })]), {});
    const hon = r.linhas.find((l) => l.origem === "honorarios")!;
    const enc = r.linhas.find((l) => l.origem === "encargos")!;
    expect(hon.valorLiquidoOs).toBe(0);
    expect(enc.valorLiquidoOs).toBe(enc.valorEc);
  });

  it("custo interno entra como custo puro — sem valor na EC", () => {
    const r = calcularRentabilidade(
      ec([linha({ valorPolobh: 10_000 })]),
      { l1: 8_000 },
      [{ id: "c1", descricao: "Diária da equipe", valor: 500 }]
    );
    const interno = r.linhas.find((l) => l.origem === "interno")!;
    expect(interno.valorEc).toBe(0);
    expect(interno.valorLiquidoOs).toBe(500);
    expect(interno.percent).toBeNull();
  });

  it("o percentual do rodapé é sobre o valor TOTAL da EC", () => {
    const r = calcularRentabilidade(ec([linha({ valorPolobh: 10_000 })]), { l1: 8_000 });
    expect(r.percentSobreEc).toBeCloseTo((r.totalEc - r.totalLiquidoOs) / r.totalEc);
  });

  it("puxa a justificativa do BV do item", () => {
    const r = calcularRentabilidade(
      ec([linha({ valorPolobh: 1_000, bv: { modo: "percentual", valor: 5, justificativa: "Fornecedor não dá BV." } })]),
      {}
    );
    expect(r.linhas[0].justificativa).toBe("Fornecedor não dá BV.");
  });

  it("item oculto e item vazio não entram", () => {
    const r = calcularRentabilidade(
      ec([linha({ id: "a", valorPolobh: 1_000, oculto: true }), linha({ id: "b" })]),
      {}
    );
    expect(r.linhas.filter((l) => l.origem === "item")).toHaveLength(0);
  });
});
