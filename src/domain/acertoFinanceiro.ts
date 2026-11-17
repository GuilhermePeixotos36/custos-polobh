/**
 * O ACERTO FINANCEIRO da OS — o que a Pólobh recebe de volta do fornecedor.
 *
 * Desenhado pela Pólobh no check-list de 15/09/2026, linha por linha. A conta
 * existe porque, em parte das contratações, a nota do fornecedor sai por um
 * valor MAIOR do que o serviço custou: o acréscimo passa por ele e volta para a
 * Pólobh, junto do BV combinado. O que não volta são os encargos que incidem
 * sobre esse acréscimo — eles ficam com quem emitiu a nota.
 *
 *   valor original dos serviços   ← o que foi contratado (automático; editável)
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
  /** O que o sistema sabe do valor original — o que volta quando se desfaz a digitação. */
  valorOriginalAutomatico: number;
  /** O valor original foi digitado (e não é o automático). */
  valorOriginalDigitado: boolean;
  bvSobreOriginal: number;
  valorNf: number;
  acrescimo: number;
  encargosPercentual: number;
  encargosSobreAcrescimo: number;
  devolucaoPolobh: number;
}

/**
 * O BV como percentual do valor original — 15 para R$ 300,00 sobre R$ 2.000,00.
 * Sai entre parênteses ao lado do valor na OS impressa (09/11/2026, pedido do
 * Tiago). Sem valor original ou sem BV não há percentual a mostrar: `null`.
 */
export function percentualDoBv(a: Pick<AcertoFinanceiro, "valorOriginal" | "bvSobreOriginal">): number | null {
  if (!(a.valorOriginal > 0) || !(a.bvSobreOriginal > 0)) return null;
  return r2((a.bvSobreOriginal / a.valorOriginal) * 100);
}

/**
 * Monta o acerto a partir do que a OS já sabe.
 *
 * `valorOriginal` é, por padrão, o que a CONTRATAÇÃO fechou (`valorContratado`:
 * a forma adotada em cada item, somada). Até 17/11/2026 era só o total da forma
 * "com BV e NF" — numa OS cultural, que costuma fechar sem BV, dava R$ 0,00 e a
 * nota inteira virava "acréscimo". Quando o valor de antes do acréscimo já não
 * está na OS (a EC foi atualizada), quem preenche o digita em
 * `valorOriginalServicos`, e esse valor vale. `valorNf` é o que o bloco de
 * emissão manda cobrar.
 *
 * O acréscimo nunca é negativo: nota menor que o serviço não é acréscimo
 * negativo, é outra coisa (um desconto, e ele tem campo próprio). Sem esse
 * corte, a devolução viraria um número que ninguém sabe explicar.
 */
export function calcularAcerto(
  financeiro: Pick<FinanceiroOs, "valorTotal" | "encargosAcrescimoPercentual"> & Partial<Pick<FinanceiroOs, "valorOriginalServicos">>,
  orcamento: Pick<Orcamento, "valorComBvNf">,
  /** O BV fechado item a item (`bvDaContratacao`) — a mesma fonte do Resumo. */
  bvContratado: number,
  /** O valor da contratação (`valorDaContratacao`): a forma adotada em cada item, somada. */
  valorContratado = 0
): AcertoFinanceiro {
  const automatico = r2(valorContratado > 0 ? valorContratado : orcamento.valorComBvNf || 0);
  const digitado = Number(financeiro.valorOriginalServicos);
  const valorOriginalDigitado = Number.isFinite(digitado) && digitado > 0 && r2(digitado) !== automatico;
  const valorOriginal = valorOriginalDigitado ? r2(digitado) : automatico;
  const bvSobreOriginal = r2(bvContratado || 0);
  const valorNf = r2(financeiro.valorTotal || 0);
  const acrescimo = r2(Math.max(0, valorNf - valorOriginal));
  const encargosPercentual = financeiro.encargosAcrescimoPercentual ?? ENCARGOS_ACRESCIMO_PADRAO;
  const encargosSobreAcrescimo = r2((acrescimo * encargosPercentual) / 100);
  return {
    valorOriginal,
    valorOriginalAutomatico: automatico,
    valorOriginalDigitado,
    bvSobreOriginal,
    valorNf,
    acrescimo,
    encargosPercentual,
    encargosSobreAcrescimo,
    devolucaoPolobh: r2(bvSobreOriginal + acrescimo - encargosSobreAcrescimo),
  };
}
