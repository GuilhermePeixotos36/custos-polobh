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
 *   valor líquido                  = valor original − BV
 *   valor da NF                    ← o que a nota cobra (automático)
 *   acréscimo                      = valor da NF − valor original
 *   encargos sobre o acréscimo     = % (editável) × acréscimo
 *   devolução Pólobh               = BV + acréscimo − encargos sobre o acréscimo
 *
 * Tudo calculado, e nada digitado a não ser o percentual: era esta conta que se
 * fazia na calculadora, por OS, e que não ficava registrada em lugar nenhum.
 *
 * O cálculo aparece sempre (24/11/2026): saiu a opção "Não se aplica".
 */
import type { FinanceiroOs, Orcamento } from "@/data/types";

/*
 * "Não se aplica" SAIU do acerto (24/11/2026, pedido da Pólobh): o cálculo do acerto financeiro
 * aparece SEMPRE, na OS em rascunho e na emitida. Antes, a OS emitida sem escolha gravada caía em
 * "não se aplica" sozinha (`acertoNaoSeAplica ?? osEmitida`) e o cálculo sumia na emissão. A marca
 * `financeiro.acertoNaoSeAplica` que ficou gravada em OSs antigas é ignorada.
 */

/** Duas casas — a mesma régua de arredondamento do resto do sistema. */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** O percentual de encargos que a casa usa quando ninguém informa outro. */
export const ENCARGOS_ACRESCIMO_PADRAO = 16.33;

/** As linhas do acerto que se podem digitar por cima do cálculo (18/11/2026). */
export type CampoAcerto =
  | "valorOriginal"
  | "bvSobreOriginal"
  | "valorNf"
  | "acrescimo"
  | "encargosSobreAcrescimo"
  | "devolucaoPolobh";

export interface AcertoFinanceiro {
  /** O que o sistema calcularia em cada linha (com o que está acima dela) — o "voltar ao automático". */
  automatico: Record<CampoAcerto, number>;
  /** As linhas que estão com valor digitado (diferente do automático). */
  digitado: Record<CampoAcerto, boolean>;
  valorOriginal: number;
  /** O que o sistema sabe do valor original — o que volta quando se desfaz a digitação. */
  valorOriginalAutomatico: number;
  /** O valor original foi digitado (e não é o automático). */
  valorOriginalDigitado: boolean;
  bvSobreOriginal: number;
  /**
   * Valor líquido = valor original − BV (27/11/2026). Era uma linha do bloco
   * "Resumo dos Custos", que saiu da OS; os cálculos ficaram todos aqui.
   */
  valorLiquido: number;
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
  financeiro: Pick<FinanceiroOs, "valorTotal" | "encargosAcrescimoPercentual"> &
    Partial<Pick<FinanceiroOs, "valorOriginalServicos" | "acertoDigitado">>,
  orcamento: Pick<Orcamento, "valorComBvNf">,
  /** O BV fechado item a item (`bvDaContratacao`) — a mesma fonte do Resumo. */
  bvContratado: number,
  /** O valor da contratação (`valorDaContratacao`): a forma adotada em cada item, somada. */
  valorContratado = 0
): AcertoFinanceiro {
  const dig = { ...(financeiro.acertoDigitado ?? {}) };
  // O primeiro campo digitável (17/11/2026) morava à parte; continua valendo.
  if (dig.valorOriginal === undefined && Number(financeiro.valorOriginalServicos) > 0) {
    dig.valorOriginal = Number(financeiro.valorOriginalServicos);
  }
  const automatico = {} as Record<CampoAcerto, number>;
  const digitado = {} as Record<CampoAcerto, boolean>;
  /** O valor de uma linha: o digitado, quando há e difere do calculado; senão, o calculado. */
  const linha = (campo: CampoAcerto, calculado: number): number => {
    const auto = r2(calculado);
    automatico[campo] = auto;
    const d = Number(dig[campo]);
    digitado[campo] = dig[campo] !== undefined && Number.isFinite(d) && r2(d) !== auto;
    return digitado[campo] ? r2(d) : auto;
  };

  const valorOriginal = linha("valorOriginal", valorContratado > 0 ? valorContratado : orcamento.valorComBvNf || 0);
  const bvSobreOriginal = linha("bvSobreOriginal", bvContratado || 0);
  const valorNf = linha("valorNf", financeiro.valorTotal || 0);
  const acrescimo = linha("acrescimo", Math.max(0, valorNf - valorOriginal));
  const encargosPercentual = financeiro.encargosAcrescimoPercentual ?? ENCARGOS_ACRESCIMO_PADRAO;
  const encargosSobreAcrescimo = linha("encargosSobreAcrescimo", (acrescimo * encargosPercentual) / 100);
  const devolucaoPolobh = linha("devolucaoPolobh", bvSobreOriginal + acrescimo - encargosSobreAcrescimo);
  return {
    automatico,
    digitado,
    valorOriginal,
    valorOriginalAutomatico: automatico.valorOriginal,
    valorOriginalDigitado: digitado.valorOriginal,
    bvSobreOriginal,
    valorLiquido: r2(valorOriginal - bvSobreOriginal),
    valorNf,
    acrescimo,
    encargosPercentual,
    encargosSobreAcrescimo,
    devolucaoPolobh,
  };
}
