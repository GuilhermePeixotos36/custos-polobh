import { describe, expect, it } from "vitest";
import {
  calcularTotais,
  valorTaxa,
  numeroEc,
  descritivoConsolidado,
  textoObjetoContrato,
  honorariosPadrao,
  encargosPadrao,
  HONORARIOS,
  ENCARGOS,
} from "./calc";
import type { EcLinha, Producao } from "@/data/types";

const producaoZero: Producao = {
  despesasOperacionais: 0, equipeBH: 0, equipeViagem: 0, transporteBH: 0,
  transporteViagem: 0, alimentacaoBH: 0, alimentacaoViagem: 0,
  qtdDespesas: 0, qtdEquipeBH: 0, qtdEquipeViagem: 0, qtdTransporteBH: 0,
  qtdTransporteViagem: 0, qtdAlimentacaoBH: 0, qtdAlimentacaoViagem: 0,
};

function linha(p: Partial<EcLinha>): EcLinha {
  return {
    id: "l1", grupo: "G", item: "Item", descricao: "", descricaoCompleta: "",
    valorPolobh: 0, valorCliente: 0, valorGasto: 0, statusAprovacao: "Pendente",
    fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
    codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
  };
}

describe("valorTaxa", () => {
  it("percentual aplica a fração sobre a base", () => {
    expect(valorTaxa({ modo: "percentual", valor: 0.15 }, 1000)).toBe(150);
  });

  it("fixo ignora a base", () => {
    expect(valorTaxa({ modo: "fixo", valor: 500 }, 1000)).toBe(500);
  });
});

describe("calcularTotais", () => {
  const linhas = [
    linha({ id: "a", valorPolobh: 10_000 }),
    linha({ id: "b", valorCliente: 5_000 }),
  ];

  it("separa o lado Pólobh do lado Cliente", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.somaFornecedores).toBe(10_000);
    expect(t.somaCliente).toBe(5_000);
  });

  it("aplica honorários e encargos padrão sobre a soma de fornecedores", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.honorariosPolobh).toBe(10_000 * HONORARIOS);
    expect(t.encargos).toBeCloseTo(10_000 * ENCARGOS, 2);
    // honorários do cliente saem sobre o lado cliente, não sobre fornecedores
    expect(t.honorariosCliente).toBe(5_000 * HONORARIOS);
  });

  it("fecha a identidade: faturamento Pólobh + terceiros = valor total bruto", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.faturamentoPolobh + t.faturamentoTerceiros).toBeCloseTo(t.valorTotalBruto, 2);
  });

  it("mantém a identidade também com taxa fixa", () => {
    const t = calcularTotais(linhas, producaoZero, { modo: "fixo", valor: 900 }, { modo: "fixo", valor: 300 });
    expect(t.honorariosPolobh).toBe(900);
    expect(t.encargos).toBe(300);
    // no modo fixo não há honorário sobre o lado cliente
    expect(t.honorariosCliente).toBe(0);
    expect(t.faturamentoPolobh + t.faturamentoTerceiros).toBeCloseTo(t.valorTotalBruto, 2);
  });

  it("ignora itens ocultos nos totais", () => {
    const comOculto = [...linhas, linha({ id: "c", valorPolobh: 99_999, oculto: true })];
    const t = calcularTotais(comOculto, producaoZero);
    expect(t.somaFornecedores).toBe(10_000);
  });

  it("trata EC vazia sem quebrar", () => {
    const t = calcularTotais([], producaoZero);
    expect(t.valorTotalBruto).toBe(0);
    expect(t.faturamentoPolobh).toBe(0);
  });

  it("arredonda em duas casas a cada etapa", () => {
    const t = calcularTotais([linha({ valorPolobh: 33.333 })], producaoZero, honorariosPadrao(), encargosPadrao());
    for (const v of [t.somaFornecedores, t.honorariosPolobh, t.encargos, t.subTotalPolobh, t.valorTotalBruto]) {
      expect(Number.isInteger(Math.round(v * 100))).toBe(true);
      expect(v).toBeCloseTo(Number(v.toFixed(2)), 10);
    }
  });
});

describe("numeroEc", () => {
  it("remove acentos e zera à esquerda a versão", () => {
    const n = numeroEc("BANCO MERCANTIL", "Convenção Anual de Lideranças", 2);
    expect(n).toContain("V02");
    expect(n).toContain("Convencao Anual de Liderancas");
    expect(n).not.toMatch(/[çãáéíóú]/i);
  });
});

describe("descritivoConsolidado", () => {
  it("junta os itens em bullets e descarta linha sem conteúdo", () => {
    const txt = descritivoConsolidado([
      linha({ id: "a", item: "Som", descricao: "PA line array" }),
      linha({ id: "b", item: "", descricao: "" }),
    ]);
    expect(txt).toBe("• Som — PA line array");
  });
});

describe("textoObjetoContrato", () => {
  const base = {
    tomador: "" as const, descritivoNf: "", cnae: "", codigoServico: "",
    valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0,
    bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "",
  };

  it("usa os dados de faturamento quando preenchidos", () => {
    const txt = textoObjetoContrato({
      ...base,
      projetoIncentivado: "Festival X",
      leiIncentivo: "Lei Rouanet",
      numeroProjetoIncentivado: "12345",
    });
    expect(txt).toContain("projeto Festival X");
    expect(txt).toContain("aprovado pela Lei Rouanet");
    expect(txt).toContain("sob o número 12345");
    expect(txt).toContain("CONTRATANTE");
  });

  it("marca visivelmente o que falta em vez de mentir", () => {
    const txt = textoObjetoContrato(base);
    expect(txt).toContain("[projeto incentivado]");
    expect(txt).toContain("[número do projeto incentivado]");
  });
});
