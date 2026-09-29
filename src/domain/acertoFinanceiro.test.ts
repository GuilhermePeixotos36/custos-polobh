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
