import { describe, expect, it } from "vitest";
import { calcularAcerto, ENCARGOS_ACRESCIMO_PADRAO } from "./acertoFinanceiro";

const orcamento = (valorComBvNf: number) => ({ valorComBvNf });

describe("acerto financeiro — quanto o fornecedor devolve à Pólobh", () => {
  it("sem acréscimo, a devolução é o BV", () => {
    const a = calcularAcerto({ valorTotal: 10_000 }, orcamento(10_000), 1_500);
    expect(a.acrescimo).toBe(0);
    expect(a.encargosSobreAcrescimo).toBe(0);
    expect(a.devolucaoPolobh).toBe(1_500);
  });

  it("com acréscimo, soma o acréscimo e desconta os encargos sobre ele", () => {
    // Serviço de 10.000, nota de 12.000: 2.000 de acréscimo, 16,33% de encargos
    // sobre esses 2.000 (326,60) e o BV de 1.500 por cima.
    const a = calcularAcerto({ valorTotal: 12_000 }, orcamento(10_000), 1_500);
    expect(a.acrescimo).toBe(2_000);
    expect(a.encargosPercentual).toBe(ENCARGOS_ACRESCIMO_PADRAO);
    expect(a.encargosSobreAcrescimo).toBe(326.6);
    expect(a.devolucaoPolobh).toBe(3_173.4);
  });

  it("o percentual de encargos é o único número digitado", () => {
    const a = calcularAcerto({ valorTotal: 12_000, encargosAcrescimoPercentual: 10 }, orcamento(10_000), 0);
    expect(a.encargosSobreAcrescimo).toBe(200);
    expect(a.devolucaoPolobh).toBe(1_800);
  });

  // Nota menor que o serviço não é acréscimo negativo — é outra coisa (um
  // desconto, que tem campo próprio). Sem o corte, a devolução viraria um
  // número que ninguém sabe explicar.
  it("nota menor que o serviço não vira acréscimo negativo", () => {
    const a = calcularAcerto({ valorTotal: 8_000 }, orcamento(10_000), 1_500);
    expect(a.acrescimo).toBe(0);
    expect(a.devolucaoPolobh).toBe(1_500);
  });

  it("OS zerada não quebra a conta", () => {
    const a = calcularAcerto({ valorTotal: 0 }, orcamento(0), 0);
    expect(a.devolucaoPolobh).toBe(0);
  });
});

describe("o valor original dos serviços (17/11/2026)", () => {
  // O caso do Tiago: OS cultural fechada SEM BV — o total "com BV e NF" é zero.
  const fin = { valorTotal: 2500, encargosAcrescimoPercentual: 18 };
  const orc = { valorComBvNf: 0 };

  it("por padrão é o valor da contratação, e não só o da forma com BV e NF", () => {
    const a = calcularAcerto(fin, orc, 0, 2500);
    expect(a.valorOriginal).toBe(2500);
    expect(a.valorOriginalDigitado).toBe(false);
    expect(a.acrescimo).toBe(0);
  });

  it("sem valor de contratação, cai no total da forma com BV e NF (como antes)", () => {
    expect(calcularAcerto({ valorTotal: 1000 }, { valorComBvNf: 800 }, 0, 0).valorOriginal).toBe(800);
  });

  it("o valor digitado vale: 2.100 + 400 de acréscimo, encargos de 18% e devolução de 328", () => {
    const a = calcularAcerto({ ...fin, valorOriginalServicos: 2100 }, orc, 0, 2500);
    expect(a).toMatchObject({
      valorOriginal: 2100,
      valorOriginalAutomatico: 2500,
      valorOriginalDigitado: true,
      valorNf: 2500,
      acrescimo: 400,
      encargosSobreAcrescimo: 72,
      devolucaoPolobh: 328,
    });
  });

  it("digitar o mesmo valor do automático, ou zero, não conta como digitado", () => {
    expect(calcularAcerto({ ...fin, valorOriginalServicos: 2500 }, orc, 0, 2500).valorOriginalDigitado).toBe(false);
    expect(calcularAcerto({ ...fin, valorOriginalServicos: 0 }, orc, 0, 2500).valorOriginal).toBe(2500);
  });
});
