/**
 * O ACERTO FINANCEIRO da OS — o que a Pólobh recebe de volta do fornecedor.
 *
 * Desenhado pela Pólobh no check-list de 15/09/2026, linha por linha. A conta
 * existe porque, em parte das contratações, a nota do fornecedor sai por um
 * valor MAIOR do que o serviço custou: o acréscimo passa por ele e volta para a
 * Pólobh, junto do BV combinado. O que não volta são os encargos que incidem
 * sobre esse acréscimo — eles ficam com quem emitiu a nota.
 *
 *   valor original dos serviços   ← o que foi contratado (automático)
 *   BV sobre o valor original      ← o combinado item a item (automático)
 *   valor da NF                    ← o que a nota cobra (automático)
 *   acréscimo                      = valor da NF − valor original
 *   encargos sobre o acréscimo     = % (editável) × acréscimo
 *   devolução Pólobh               = BV + acréscimo − encargos sobre o acréscimo
 *
 * Tudo calculado, e nada digitado a não ser o percentual: era esta conta que se
 * fazia na calculadora, por OS, e que não ficava registrada em lugar nenhum.
 *
 * "Não se aplica" é o padrão, e é resposta — a maioria das OS não tem acerto
 * nenhum, e um bloco de seis campos zerados em todas elas seria ruído.
 */
import type { FinanceiroOs, Orcamento } from "@/data/types";

/** Duas casas — a mesma régua de arredondamento do resto do sistema. */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** O percentual de encargos que a casa usa quando ninguém informa outro. */
export const ENCARGOS_ACRESCIMO_PADRAO = 16.33;

export interface AcertoFinanceiro {
  valorOriginal: number;
  bvSobreOriginal: number;
  valorNf: number;
  acrescimo: number;
  encargosPercentual: number;
  encargosSobreAcrescimo: number;
  devolucaoPolobh: number;
}

/**
 * Monta o acerto a partir do que a OS já sabe.
 *
 * `valorOriginal` é o total da forma COM BV E NF — é a única das três em que
 * existe BV, e é dela que este acerto trata. `valorNf` é o que o bloco de
 * emissão manda cobrar.
 *
 * O acréscimo nunca é negativo: nota menor que o serviço não é acréscimo
 * negativo, é outra coisa (um desconto, e ele tem campo próprio). Sem esse
 * corte, a devolução viraria um número que ninguém sabe explicar.
 */
export function calcularAcerto(
  financeiro: Pick<FinanceiroOs, "valorTotal" | "encargosAcrescimoPercentual">,
  orcamento: Pick<Orcamento, "valorComBvNf">,
  /** O BV fechado item a item (`bvDaContratacao`) — a mesma fonte do Resumo. */
  bvContratado: number
): AcertoFinanceiro {
  const valorOriginal = r2(orcamento.valorComBvNf || 0);
  const bvSobreOriginal = r2(bvContratado || 0);
  const valorNf = r2(financeiro.valorTotal || 0);
  const acrescimo = r2(Math.max(0, valorNf - valorOriginal));
  const encargosPercentual = financeiro.encargosAcrescimoPercentual ?? ENCARGOS_ACRESCIMO_PADRAO;
  const encargosSobreAcrescimo = r2((acrescimo * encargosPercentual) / 100);
  return {
    valorOriginal,
    bvSobreOriginal,
    valorNf,
    acrescimo,
    encargosPercentual,
    encargosSobreAcrescimo,
    devolucaoPolobh: r2(bvSobreOriginal + acrescimo - encargosSobreAcrescimo),
  };
}
