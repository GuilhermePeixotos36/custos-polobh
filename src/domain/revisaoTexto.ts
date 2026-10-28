/**
 * QUAIS textos o revisor de português toca, em cada documento.
 *
 * A Pólobh pediu "obrigar o sistema a fazer uma revisão de texto em todos os
 * textos do aplicativo". Este módulo é a leitura dessa frase, escrita num lugar
 * só — antes ela estava espalhada por três telas, e por isso a EC tinha o
 * revisor programado e NÃO LIGADO: a função existia, ninguém a chamava, e de
 * fora parecia que a revisão acontecia.
 *
 * O QUE ENTRA: todo texto livre que uma pessoa escreve e que DEPOIS ALGUÉM LÊ
 * fora da casa ou num documento — descritivo, entrega, observações gerais,
 * cronograma, logística, infraestrutura, os itens da EC e as tarefas do
 * check-list.
 *
 * O QUE NÃO ENTRA, e cada um por um motivo diferente:
 *
 *  · as CONVERSAS (observações de EC, de projeto, de item, de chamado). São as
 *    palavras de uma pessoa falando com outra. Reescrever o recado de alguém —
 *    ainda que só a vírgula — é mexer no que ela disse, e num histórico que
 *    serve de prova do que foi combinado;
 *  · as CLÁUSULAS DO CONTRATO. É texto jurídico, aprovado como está. Uma
 *    "correção" de concordância numa cláusula de rescisão é risco sem ganho;
 *  · os CADASTROS (nome, razão social, CNPJ, e-mail, código de serviço, número
 *    de pedido). Não são prosa: são identificadores, e "corrigir" um deles é
 *    estragá-lo. A padronização de caixa desses campos já acontece na gravação,
 *    por regra determinística (ver `domain/textos`).
 */
import type { EcLinha, ItemChecklist, Os } from "@/data/types";

/** Um texto a revisar, endereçado por um id que sabe voltar para o lugar dele. */
export interface CampoRevisavel {
  id: string;
  texto: string;
  /** Rich-text do editor: o revisor precisa preservar as tags. */
  html?: boolean;
  /** Além de revisar, deixa o texto em tópicos (bullets). Ver `emTopicos`. */
  topicos?: boolean;
}

const vale = (t: string | undefined | null): boolean => Boolean(t && t.trim());

/* -------------------------------------------------------------------------- */
/*                                     EC                                     */
/* -------------------------------------------------------------------------- */

export function camposDaEc(linhas: EcLinha[]): CampoRevisavel[] {
  const campos: CampoRevisavel[] = [];
  for (const l of linhas) {
    if (vale(l.item)) campos.push({ id: `ec:${l.id}:item`, texto: l.item });
    if (vale(l.descricao)) campos.push({ id: `ec:${l.id}:descricao`, texto: l.descricao });
    if (vale(l.descricaoCompleta)) {
      campos.push({ id: `ec:${l.id}:completa`, texto: l.descricaoCompleta, html: true, topicos: true });
    }
  }
  return campos;
}

export function aplicarNaEc(linhas: EcLinha[], revisados: Map<string, string>): EcLinha[] {
  return linhas.map((l) => ({
    ...l,
    item: revisados.get(`ec:${l.id}:item`) ?? l.item,
    descricao: revisados.get(`ec:${l.id}:descricao`) ?? l.descricao,
    descricaoCompleta: revisados.get(`ec:${l.id}:completa`) ?? l.descricaoCompleta,
  }));
}

/* -------------------------------------------------------------------------- */
/*                                     OS                                     */
/* -------------------------------------------------------------------------- */

/** Os campos de Logística que são prosa (os demais são escolha ou valor). */
const CAMPOS_LOGISTICA = [
  "transporteMaterial", "transporteEquipe", "hospedagem", "alimentacao",
  "estacionamentoCarga", "estacionamentoEquipe", "uniformizacao",
] as const;

const CAMPOS_INFRA = [
  "energia", "internet", "pontosEletricos", "estruturas", "servicosApoio", "artLaudos",
] as const;

export function camposDaOs(os: Os): CampoRevisavel[] {
  const campos: CampoRevisavel[] = [];
  const por = (id: string, texto: string | undefined, html = false) => {
    if (vale(texto)) campos.push({ id, texto: texto!, html });
  };

  por("os:descritivo", os.descritivo, true);
  por("os:entrega", os.entrega, true);
  // "Não se aplica" marcado: o texto não sai no documento, e revisar o que
  // ninguém vai ler é gastar por nada.
  if (!os.observacoesGeraisNaoSeAplica) por("os:observacoesGerais", os.observacoesGerais, true);

  if (!os.cronogramaNaoSeAplica) {
    (os.cronograma ?? []).forEach((c, i) => por(`os:crono:${c.id ?? i}`, c.atividades));
  }

  for (const campo of CAMPOS_LOGISTICA) por(`os:log:${campo}`, os.logistica?.[campo]);
  for (const campo of CAMPOS_INFRA) {
    if (os.infraestrutura?.naoAplicaveis?.includes(campo)) continue;
    por(`os:infra:${campo}`, os.infraestrutura?.[campo]);
  }
  for (const extra of os.infraestrutura?.extras ?? []) {
    if (!extra.naoSeAplica) por(`os:infra:extra:${extra.id}`, extra.valor);
  }

  for (const grupo of os.gruposExtras ?? []) {
    if (grupo.naoSeAplica) continue;
    for (const item of grupo.itens ?? []) {
      if (!item.naoSeAplica) por(`os:grupo:${grupo.id}:${item.id}`, item.valor);
    }
  }

  return campos;
}

export function aplicarNaOs(os: Os, r: Map<string, string>): Os {
  const pegar = (id: string, atual: string) => r.get(id) ?? atual;
  return {
    ...os,
    descritivo: pegar("os:descritivo", os.descritivo),
    entrega: pegar("os:entrega", os.entrega),
    observacoesGerais: pegar("os:observacoesGerais", os.observacoesGerais),
    cronograma: (os.cronograma ?? []).map((c, i) => ({
      ...c,
      atividades: pegar(`os:crono:${c.id ?? i}`, c.atividades),
    })),
    logistica: os.logistica && {
      ...os.logistica,
      ...Object.fromEntries(
        CAMPOS_LOGISTICA.map((campo) => [campo, pegar(`os:log:${campo}`, os.logistica[campo])]),
      ),
    },
    infraestrutura: os.infraestrutura && {
      ...os.infraestrutura,
      ...Object.fromEntries(
        CAMPOS_INFRA.map((campo) => [campo, pegar(`os:infra:${campo}`, os.infraestrutura[campo])]),
      ),
      extras: (os.infraestrutura.extras ?? []).map((e) => ({
        ...e,
        valor: pegar(`os:infra:extra:${e.id}`, e.valor),
      })),
    },
    gruposExtras: (os.gruposExtras ?? []).map((g) => ({
      ...g,
      itens: (g.itens ?? []).map((i) => ({ ...i, valor: pegar(`os:grupo:${g.id}:${i.id}`, i.valor) })),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*                                 check-list                                 */
/* -------------------------------------------------------------------------- */

export function camposDoChecklist(itens: ItemChecklist[]): CampoRevisavel[] {
  const campos: CampoRevisavel[] = [];
  for (const i of itens) {
    if (vale(i.titulo)) campos.push({ id: `chk:${i.id}:titulo`, texto: i.titulo });
    if (vale(i.descricao)) campos.push({ id: `chk:${i.id}:descricao`, texto: i.descricao });
  }
  return campos;
}

export function aplicarNoChecklist(itens: ItemChecklist[], r: Map<string, string>): ItemChecklist[] {
  return itens.map((i) => ({
    ...i,
    titulo: r.get(`chk:${i.id}:titulo`) ?? i.titulo,
    descricao: r.get(`chk:${i.id}:descricao`) ?? i.descricao,
  }));
}

/* -------------------------------------------------------------------------- */
/*                          o que de fato precisa ir                          */
/* -------------------------------------------------------------------------- */

/**
 * Só o que MUDOU desde a última gravação.
 *
 * É esta função que responde à ressalva do check-list ("estender a revisão
 * aumenta o custo por salvamento"). Sem ela, salvar uma OS de sessenta linhas
 * para corrigir um número mandaria as sessenta descrições para a IA de novo,
 * toda vez — e a conta cresceria com o número de SALVAMENTOS, que é enorme,
 * em vez de com o número de EDIÇÕES DE TEXTO, que é pequeno.
 *
 * O texto que ninguém tocou já foi revisado no salvamento em que nasceu.
 * Mandá-lo outra vez não muda uma vírgula: paga-se para receber de volta o que
 * já se tem.
 */
export function apenasMudados(
  campos: CampoRevisavel[],
  anteriores: Map<string, string>,
): CampoRevisavel[] {
  return campos.filter((c) => anteriores.get(c.id) !== c.texto);
}

/** O retrato dos textos de um documento, para comparar no próximo salvamento. */
export const retratoDeTextos = (campos: CampoRevisavel[]): Map<string, string> =>
  new Map(campos.map((c) => [c.id, c.texto]));
