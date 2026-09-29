/**
 * A RENTABILIDADE do projeto, linha a linha — quanto sobra do que a EC cobrou.
 *
 * Redesenhada em 15/09/2026 a pedido da Pólobh. A tabela antiga tinha quatro
 * colunas (Item · Estimado · Gasto OS · Rentabilidade) e respondia a uma
 * pergunta menor do que a que a casa faz: ela comparava o custo estimado de cada
 * item com o que foi pago por ele, e ignorava as duas linhas que compõem o preço
 * — honorários e encargos — e tudo o que a Pólobh gasta por dentro e não está na
 * EC.
 *
 * O que mudou, e por quê:
 *
 *  · os nomes das colunas passaram a ser os do check-list — **Valor na EC**,
 *    **Valor Líquido OS** —, que é como a casa fala;
 *  · **honorários e encargos entram como linha**, porque eles estão no valor
 *    total da EC. Sem eles, a soma da tabela não batia com o documento;
 *  · **outros custos internos** entram como linhas lançadas à mão: a diária da
 *    equipe, o combustível, o que a Pólobh gasta e não cobra do cliente item a
 *    item;
 *  · o **percentual é sobre o valor total da EC**, e não sobre cada item, como
 *    pede o check-list.
 *
 * ⚠️ UMA PREMISSA A CONFERIR, e está aqui em vez de escondida no código:
 * honorários entram como RECEITA (gasto zero — é a margem da casa) e encargos
 * como CUSTO REAL (gasto igual ao valor — é imposto que se paga). Foi a leitura
 * que fizemos de "acrescentar no cálculo as linhas de custos Honorários Pólobh e
 * Encargos"; se a Pólobh contabiliza os encargos de outro jeito, é a constante
 * `ENCARGOS_SAO_CUSTO`, abaixo, que muda — e só ela.
 */
import type { Ec, EcLinha } from "@/data/types";
import { calcularTotais, rentabilidadeItem } from "@/domain/calc";

/** Um custo da Pólobh que não aparece na EC — lançado à mão nesta aba. */
export interface CustoInterno {
  id: string;
  descricao: string;
  valor: number;
}

/** Ver a premissa no cabeçalho deste arquivo. */
const ENCARGOS_SAO_CUSTO = true;

export type OrigemLinha = "item" | "honorarios" | "encargos" | "interno";

export interface LinhaRentabilidade {
  id: string;
  origem: OrigemLinha;
  /** Como a linha se chama na tabela. */
  item: string;
  grupo: string;
  /** O que a EC cobrou por ela. */
  valorEc: number;
  /** O que saiu das OSs (ou, nos custos internos, o que foi lançado). */
  valorLiquidoOs: number;
  /** (Valor na EC − Valor Líquido OS) ÷ Valor na EC — desta linha. */
  percent: number | null;
  /** Por que o BV ficou fora do padrão neste item — a justificativa da EC. */
  justificativa: string;
}

export interface Rentabilidade {
  linhas: LinhaRentabilidade[];
  totalEc: number;
  totalLiquidoOs: number;
  /** A margem sobre o TOTAL da EC, como pede o check-list. */
  percentSobreEc: number | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A justificativa que a tabela mostra: a do BV do item, quando ele saiu abaixo
 * do padrão da casa. É a resposta de "por que este item rendeu menos" — e era
 * a informação que obrigava a abrir a EC item a item para achar.
 */
const justificativaDaLinha = (l: EcLinha): string => (l.bv?.justificativa ?? "").trim();

export function calcularRentabilidade(
  ec: Ec,
  gastoPorLinha: Record<string, number>,
  custosInternos: CustoInterno[] = []
): Rentabilidade {
  const linhas: LinhaRentabilidade[] = [];

  for (const l of ec.linhas ?? []) {
    if (l.oculto) continue;
    const gasto = gastoPorLinha[l.id] ?? l.valorGasto ?? 0;
    const r = rentabilidadeItem({ ...l, valorGasto: gasto });
    // Item sem custo na EC e sem pagamento não diz nada — é linha em branco.
    if (r.estimado === 0 && r.gasto === 0) continue;
    linhas.push({
      id: l.id,
      origem: "item",
      item: l.item || l.descricao || "—",
      grupo: l.grupo || "GERAL",
      valorEc: r.estimado,
      valorLiquidoOs: r.gasto,
      percent: r.percent,
      justificativa: justificativaDaLinha(l),
    });
  }

  // As duas linhas que compõem o preço e não são item de fornecedor.
  const totais = calcularTotais(ec.linhas ?? [], ec.producao, ec.honorarios, ec.encargos);
  if (totais.honorariosPolobh > 0) {
    linhas.push({
      id: "__honorarios",
      origem: "honorarios",
      item: ec.honorariosRotulo || "Honorários Pólobh",
      grupo: "PÓLOBH",
      valorEc: r2(totais.honorariosPolobh),
      // Honorário é a margem da casa: não há gasto contra ele.
      valorLiquidoOs: 0,
      percent: 1,
      justificativa: "",
    });
  }
  if (totais.encargos > 0) {
    const custo = ENCARGOS_SAO_CUSTO ? r2(totais.encargos) : 0;
    linhas.push({
      id: "__encargos",
      origem: "encargos",
      item: ec.encargosRotulo || "Encargos",
      grupo: "PÓLOBH",
      valorEc: r2(totais.encargos),
      valorLiquidoOs: custo,
      percent: custo >= totais.encargos ? 0 : 1 - custo / totais.encargos,
      justificativa: ENCARGOS_SAO_CUSTO ? "Encargos são custo da casa (ver domain/rentabilidade)." : "",
    });
  }

  // O que a Pólobh gasta por dentro e não está na EC: entra como custo puro.
  for (const c of custosInternos) {
    if (!c.valor && !c.descricao.trim()) continue;
    linhas.push({
      id: c.id,
      origem: "interno",
      item: c.descricao.trim() || "Custo interno",
      grupo: "CUSTOS INTERNOS",
      valorEc: 0,
      valorLiquidoOs: r2(c.valor || 0),
      // Sem valor na EC não há percentual: é custo que não foi cobrado.
      percent: null,
      justificativa: "",
    });
  }

  const totalEc = r2(linhas.reduce((s, l) => s + l.valorEc, 0));
  const totalLiquidoOs = r2(linhas.reduce((s, l) => s + l.valorLiquidoOs, 0));
  return {
    linhas,
    totalEc,
    totalLiquidoOs,
    percentSobreEc: totalEc > 0 ? (totalEc - totalLiquidoOs) / totalEc : null,
  };
}
