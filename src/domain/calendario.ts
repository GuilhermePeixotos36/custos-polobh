/**
 * Calendário anual dos projetos — o "quadro do ano" da produção.
 *
 * Substitui o quadro preto onde a equipe anotava, à mão, tudo o que aconteceria
 * no ano. Nada é digitado duas vezes: o calendário lê os projetos que já
 * existem, e um projeto novo aparece assim que ganha data.
 *
 * O QUE ENTRA mudou em 15/09/2026. Era só a etapa "Evento" — "no quadro
 * interessa quando o projeto ACONTECE, não quando a equipe entra no local" —, e
 * a Pólobh pediu o contrário: *"o sistema deverá registrar o período completo,
 * considerando Montagem, Evento e Desmontagem"*. O motivo é de quem usa: quem
 * olha o quadro está decidindo se cabe mais um projeto na semana, e a equipe
 * está ocupada desde a montagem — um evento de sábado com montagem na
 * quinta-feira bloqueia três dias, não um.
 *
 * As outras duas etapas do cronograma (alinhamentos e ensaios) continuam fora:
 * elas são reuniões, não ocupação de equipe no local.
 *
 * Por isso cada projeto do quadro traz DUAS leituras: o `periodo` inteiro, que
 * é o que a barra desenha, e as `etapas`, que dão a cor de cada trecho.
 */
import type { Ec, ModalidadeProjeto, Projeto, StatusProjeto } from "@/data/types";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const;

/** Iniciais dos dias da semana, começando no domingo (índice de `Date.getDay()`). */
export const INICIAIS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Data ISO (aaaa-mm-dd) de um dia do calendário. `mes` é 0-11, como no `Date`. */
export const isoDoDia = (ano: number, mes: number, dia: number): string =>
  `${ano}-${doisDigitos(mes + 1)}-${doisDigitos(dia)}`;

/** Quantidade de dias do mês (`mes` 0-11) — cobre fevereiro e anos bissextos. */
export const diasNoMes = (ano: number, mes: number): number => new Date(ano, mes + 1, 0).getDate();

/** Dia da semana (0 = domingo) de um dia do calendário. */
export const diaDaSemana = (ano: number, mes: number, dia: number): number =>
  new Date(ano, mes, dia).getDay();

export const fimDeSemana = (ano: number, mes: number, dia: number): boolean => {
  const d = diaDaSemana(ano, mes, dia);
  return d === 0 || d === 6;
};

/** Hoje em ISO, no fuso local (o `toISOString` puro erra o dia à noite no Brasil). */
export const hojeIso = (base = new Date()): string =>
  isoDoDia(base.getFullYear(), base.getMonth(), base.getDate());

const ano = (iso: string) => Number(iso.slice(0, 4));
const mes = (iso: string) => Number(iso.slice(5, 7)) - 1;
const dia = (iso: string) => Number(iso.slice(8, 10));

/* ------------------------------- período --------------------------------- */

export interface PeriodoProjeto {
  inicio: string;
  fim: string;
}

/** As etapas que OCUPAM a equipe — as que o quadro do ano desenha. */
export const ETAPAS_DO_QUADRO = ["montagem", "evento", "desmontagem"] as const;
export type EtapaDoQuadro = (typeof ETAPAS_DO_QUADRO)[number];

/** Como cada etapa se chama na tela. */
export const ROTULO_ETAPA: Record<EtapaDoQuadro, string> = {
  montagem: "Montagem",
  evento: "Evento",
  desmontagem: "Desmontagem",
};

/**
 * O tom de cada etapa dentro da COR DO PROJETO.
 *
 * A identidade continua sendo a cor — é ela que faz reconhecer o projeto de
 * longe, no card, na barra e na lista. Cores diferentes por etapa competiriam
 * com isso e transformariam o quadro num mosaico sem dono. Então o que muda é a
 * intensidade: o evento é o cheio, montagem e desmontagem são os preparos.
 */
export const OPACIDADE_ETAPA: Record<EtapaDoQuadro, number> = {
  montagem: 0.55,
  evento: 1,
  desmontagem: 0.4,
};

/** Um trecho colorido da barra: de quando a quando cada etapa ocupa a equipe. */
export interface PeriodoEtapa extends PeriodoProjeto {
  etapa: EtapaDoQuadro;
}

/** Datas válidas de uma etapa do cronograma, já ordenadas. */
function datasDaEtapa(projeto: Projeto, etapa: EtapaDoQuadro): string[] {
  const datas: string[] = [];
  for (const faixa of projeto.info?.cronograma?.[etapa] ?? []) {
    const d = (faixa?.data ?? "").trim();
    if (RE_DATA.test(d)) datas.push(d);
  }
  return datas.sort();
}

/**
 * Cada etapa que ocupa a equipe, com o seu próprio começo e fim.
 *
 * Só entram as etapas preenchidas: projeto sem montagem cadastrada tem uma
 * barra de evento e mais nada — não se inventa um dia de montagem que ninguém
 * marcou.
 */
export function etapasDoProjeto(projeto: Projeto): PeriodoEtapa[] {
  const out: PeriodoEtapa[] = [];
  for (const etapa of ETAPAS_DO_QUADRO) {
    const datas = datasDaEtapa(projeto, etapa);
    if (datas.length) out.push({ etapa, inicio: datas[0], fim: datas[datas.length - 1] });
  }
  // Projeto anterior ao cronograma por faixas só tem o campo legado do evento.
  if (!out.length) {
    const legado = (projeto.info?.evento ?? "").trim();
    if (RE_DATA.test(legado)) out.push({ etapa: "evento", inicio: legado, fim: legado });
  }
  return out;
}

/**
 * Período do projeto no quadro: do PRIMEIRO dia de montagem ao ÚLTIMO de
 * desmontagem (15/09/2026 — antes era só a etapa Evento).
 *
 * Cada etapa aceita várias faixas (um evento de três dias tem três linhas),
 * então o período é o intervalo entre a menor e a maior data de todas elas — e
 * um projeto de um dia só vira `inicio === fim`. Projeto sem data nenhuma
 * devolve `null`: ele não some do sistema, apenas não tem onde ser desenhado.
 */
export function periodoDoProjeto(projeto: Projeto): PeriodoProjeto | null {
  const etapas = etapasDoProjeto(projeto);
  if (!etapas.length) return null;
  const inicio = etapas.reduce((a, e) => (e.inicio < a ? e.inicio : a), etapas[0].inicio);
  const fim = etapas.reduce((a, e) => (e.fim > a ? e.fim : a), etapas[0].fim);
  return { inicio, fim };
}

/** Dias corridos do período, contando as duas pontas (um dia só = 1). */
export function duracaoEmDias(periodo: PeriodoProjeto): number {
  const a = new Date(`${periodo.inicio}T00:00:00`).getTime();
  const b = new Date(`${periodo.fim}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / MS_DIA) + 1);
}

/* --------------------------------- cores --------------------------------- */

export interface CorProjeto {
  /** Fundo da barrinha (fica com texto claro por cima). */
  forte: string;
  /** Fundo suave para chips e realces. */
  suave: string;
  /** Texto sobre o fundo suave. */
  texto: string;
}

/**
 * A cor do quadro é UMA só: o Laranja Pólobh, para todos os projetos (pedido de
 * 29/09/2026). Cor por projeto competia com a leitura que importa — que dias
 * estão ocupados — e num mês cheio virava mosaico. `CorProjeto` continua no
 * formato de antes para os componentes não mudarem de assinatura.
 */
export const COR_POLOBH: CorProjeto = { forte: "#F2820D", suave: "#FDF1E3", texto: "#9A4A05" };

/** Todo projeto usa a cor da casa; o `id` fica na assinatura por compatibilidade. */
export function corDoProjeto(_id: string): CorProjeto {
  return COR_POLOBH;
}

/* ------------------------------ montagem --------------------------------- */

export interface ProjetoNoCalendario {
  id: string;
  titulo: string;
  cliente: string;
  /** Quem responde pelo projeto — filtro e coluna do quadro (15/09/2026). */
  produtora: string;
  local: string;
  modalidade: ModalidadeProjeto;
  status: StatusProjeto;
  inicio: string;
  fim: string;
  /** Dias corridos do período inteiro, contando as duas pontas. */
  dias: number;
  /** Montagem, evento e desmontagem — cada uma com o seu trecho, para a cor. */
  etapas: PeriodoEtapa[];
  cor: CorProjeto;
}

export interface CalendarioProjetos {
  /** Projetos com alguma data — os que o quadro consegue desenhar. */
  itens: ProjetoNoCalendario[];
  /**
   * Projetos sem a data do EVENTO, para a tela poder cobrá-los.
   *
   * Continua sendo o evento que se cobra, e não o período (15/09/2026): com o
   * quadro passando a desenhar montagem e desmontagem, um projeto que tem só a
   * montagem marcada já aparece — e sem esta lista ele deixaria de ser cobrado
   * justamente pelo dado que falta. Ele pode estar nos dois lugares: desenhado
   * pelo que já tem, cobrado pelo que ainda não tem.
   */
  semData: { id: string; titulo: string; cliente: string }[];
}

const nomeDoProjeto = (p: Projeto) => p.nome || p.info?.titulo || "(projeto sem título)";

/** Converte os projetos do banco no que o quadro precisa, já ordenado por data. */
export function montarCalendario(projetos: Projeto[], ecs: Ec[] = []): CalendarioProjetos {
  const itens: ProjetoNoCalendario[] = [];
  const semData: CalendarioProjetos["semData"] = [];

  for (const p of projetos) {
    const etapas = etapasDoProjeto(p);
    const periodo = periodoDoProjeto(p);
    const titulo = nomeDoProjeto(p);
    const cliente = p.cliente?.nome ?? "";
    if (!etapas.some((e) => e.etapa === "evento")) semData.push({ id: p.id, titulo, cliente });
    if (!periodo) continue;
    itens.push({
      id: p.id,
      titulo,
      cliente,
      produtora: p.info?.produtoraResponsavel?.trim() ?? "",
      local: p.info?.local ?? "",
      modalidade: p.info?.modalidade ?? "",
      status: statusProjetoAutomatico(p, ecs),
      inicio: periodo.inicio,
      fim: periodo.fim,
      dias: duracaoEmDias(periodo),
      etapas,
      cor: corDoProjeto(p.id),
    });
  }

  itens.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  semData.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  return { itens, semData };
}

/** Anos que têm projeto, em ordem — alimenta os atalhos de ano da tela. */
export function anosComProjetos(itens: ProjetoNoCalendario[]): number[] {
  const anos = new Set<number>();
  for (const i of itens) {
    for (let a = ano(i.inicio); a <= ano(i.fim); a++) anos.add(a);
  }
  return [...anos].sort((a, b) => a - b);
}

/** Projetos que tocam o ano — inclui os que viram o ano (dez → jan). */
export function projetosDoAno(itens: ProjetoNoCalendario[], anoAlvo: number): ProjetoNoCalendario[] {
  return itens.filter((i) => ano(i.inicio) <= anoAlvo && ano(i.fim) >= anoAlvo);
}

/* ------------------------------- mês a mês ------------------------------- */

export interface SegmentoMes {
  item: ProjetoNoCalendario;
  /** Primeiro dia ocupado DENTRO do mês (1-31). */
  diaInicio: number;
  /** Último dia ocupado dentro do mês. */
  diaFim: number;
  /** O projeto começou antes deste mês (a barra entra pela esquerda). */
  continuaAntes: boolean;
  /** O projeto termina depois deste mês (a barra sai pela direita). */
  continuaDepois: boolean;
}

/**
 * Recorta o período do projeto dentro de um mês.
 *
 * É o que permite a barrinha correr "de tal dia até tal dia" sem se preocupar
 * com o projeto que atravessa a virada do mês: ele aparece nos dois meses, com
 * as pontas marcadas como continuação.
 */
export function segmentoNoMes(item: ProjetoNoCalendario, anoAlvo: number, mesAlvo: number): SegmentoMes | null {
  const primeiro = isoDoDia(anoAlvo, mesAlvo, 1);
  const ultimo = isoDoDia(anoAlvo, mesAlvo, diasNoMes(anoAlvo, mesAlvo));
  if (item.fim < primeiro || item.inicio > ultimo) return null;
  const comecaAntes = item.inicio < primeiro;
  const terminaDepois = item.fim > ultimo;
  return {
    item,
    diaInicio: comecaAntes ? 1 : dia(item.inicio),
    diaFim: terminaDepois ? diasNoMes(anoAlvo, mesAlvo) : dia(item.fim),
    continuaAntes: comecaAntes,
    continuaDepois: terminaDepois,
  };
}

/** Um trecho de ETAPA recortado no mês — o que dá a cor a cada pedaço da barra. */
export interface TrechoEtapaMes {
  etapa: EtapaDoQuadro;
  diaInicio: number;
  diaFim: number;
}

/**
 * O período do projeto no mês, LADRILHADO pelas etapas (29/09/2026).
 *
 * O quadro precisa preencher o período completo, sem furo, e ainda mostrar onde
 * uma etapa acaba e a outra começa (a divisória). Então cada bloco vai do
 * começo da sua etapa até o dia anterior ao começo da próxima: se há um dia
 * vazio entre a montagem e o evento, ele pertence à montagem — o quadro não
 * deixa buraco no meio da ocupação. O primeiro bloco abre no primeiro dia do
 * período dentro do mês e o último fecha no último.
 */
export function blocosDoPeriodoNoMes(
  item: ProjetoNoCalendario,
  anoAlvo: number,
  mesAlvo: number
): TrechoEtapaMes[] {
  const seg = segmentoNoMes(item, anoAlvo, mesAlvo);
  if (!seg) return [];
  // O ladrilhamento é feito no período INTEIRO e só depois recortado no mês:
  // num mês que só tem o "vão" entre a montagem e o evento, o bloco certo é o da
  // montagem, e isso só se sabe olhando para fora do mês.
  const etapas = [...(item.etapas ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const inteiros: { etapa: EtapaDoQuadro; inicio: string; fim: string }[] = [];
  etapas.forEach((e, i) => {
    const inicio = i === 0 ? item.inicio : e.inicio;
    const proxima = etapas[i + 1];
    const fim = proxima ? (e.fim >= proxima.inicio ? e.fim : diaAntes(proxima.inicio)) : item.fim;
    const ultimo = inteiros[inteiros.length - 1];
    if (fim >= inicio && (!ultimo || inicio > ultimo.fim)) inteiros.push({ etapa: e.etapa, inicio, fim });
  });
  if (!inteiros.length) inteiros.push({ etapa: "evento", inicio: item.inicio, fim: item.fim });

  const primeiro = isoDoDia(anoAlvo, mesAlvo, 1);
  const ultimoDia = diasNoMes(anoAlvo, mesAlvo);
  const ultimoIso = isoDoDia(anoAlvo, mesAlvo, ultimoDia);
  const out: TrechoEtapaMes[] = [];
  for (const b of inteiros) {
    if (b.fim < primeiro || b.inicio > ultimoIso) continue;
    out.push({
      etapa: b.etapa,
      diaInicio: b.inicio < primeiro ? 1 : dia(b.inicio),
      diaFim: b.fim > ultimoIso ? ultimoDia : dia(b.fim),
    });
  }
  return out;
}

/** O dia anterior a uma data ISO. */
function diaAntes(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return isoDoDia(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Todos os segmentos do mês, na ordem em que começam (mais longo primeiro no empate). */
export function segmentosDoMes(
  itens: ProjetoNoCalendario[],
  anoAlvo: number,
  mesAlvo: number
): SegmentoMes[] {
  const segmentos: SegmentoMes[] = [];
  for (const item of itens) {
    const s = segmentoNoMes(item, anoAlvo, mesAlvo);
    if (s) segmentos.push(s);
  }
  return segmentos.sort(
    (a, b) =>
      a.diaInicio - b.diaInicio ||
      b.diaFim - b.diaInicio - (a.diaFim - a.diaInicio) ||
      a.item.titulo.localeCompare(b.item.titulo, "pt-BR")
  );
}

/**
 * Empilha os segmentos em trilhas que não se sobrepõem (o mesmo arranjo de uma
 * agenda: dois projetos no mesmo dia caem em linhas diferentes). Guloso e
 * estável — o segmento entra na primeira trilha livre.
 */
export function trilhasDoMes(segmentos: SegmentoMes[]): SegmentoMes[][] {
  const trilhas: SegmentoMes[][] = [];
  for (const seg of segmentos) {
    const livre = trilhas.find((t) => t[t.length - 1].diaFim < seg.diaInicio);
    if (livre) livre.push(seg);
    else trilhas.push([seg]);
  }
  return trilhas;
}

/** Quantos projetos há em cada mês do ano (12 posições, janeiro a dezembro). */
export function contagemPorMes(itens: ProjetoNoCalendario[], anoAlvo: number): number[] {
  return Array.from({ length: 12 }, (_, m) => segmentosDoMes(itens, anoAlvo, m).length);
}

/** Rótulo curto do intervalo dentro do mês: "05" ou "05 a 09". */
export const rotuloDias = (seg: SegmentoMes): string =>
  seg.diaInicio === seg.diaFim
    ? doisDigitos(seg.diaInicio)
    : `${doisDigitos(seg.diaInicio)} a ${doisDigitos(seg.diaFim)}`;

/** Rótulo longo do período do projeto: "05 a 09 de março de 2026". */
export function rotuloPeriodo(item: ProjetoNoCalendario): string {
  const [aI, mI, dI] = [ano(item.inicio), mes(item.inicio), dia(item.inicio)];
  const [aF, mF, dF] = [ano(item.fim), mes(item.fim), dia(item.fim)];
  if (item.inicio === item.fim) return `${doisDigitos(dI)} de ${MESES[mI].toLowerCase()} de ${aI}`;
  if (aI === aF && mI === mF) {
    return `${doisDigitos(dI)} a ${doisDigitos(dF)} de ${MESES[mI].toLowerCase()} de ${aI}`;
  }
  const ini = `${doisDigitos(dI)} de ${MESES_CURTOS[mI]}${aI === aF ? "" : ` de ${aI}`}`;
  return `${ini} a ${doisDigitos(dF)} de ${MESES_CURTOS[mF]} de ${aF}`;
}
