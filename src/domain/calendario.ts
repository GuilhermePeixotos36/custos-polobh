/**
 * Calendário anual dos projetos — o "quadro do ano" da produção.
 *
 * Substitui o quadro preto onde a equipe anotava, à mão, tudo o que aconteceria
 * no ano. A regra é uma só: o que entra aqui é a **data do projeto** — a etapa
 * "Evento" do cronograma. Montagem, desmontagem, alinhamentos e ensaios ficam
 * de fora de propósito: no quadro interessa quando o projeto ACONTECE, não
 * quando a equipe entra no local.
 *
 * Nada é digitado duas vezes: o calendário lê os projetos que já existem, e um
 * projeto novo aparece no quadro assim que ganha a data do evento.
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

/**
 * Período do projeto no quadro: da primeira à última data da etapa **Evento**.
 *
 * A etapa aceita várias faixas (um evento de três dias tem três linhas), então
 * o período é o intervalo entre a menor e a maior — e um evento de um dia só
 * vira `inicio === fim`. Projeto sem data de evento devolve `null`: ele não
 * some do sistema, apenas não tem onde ser desenhado ainda.
 */
export function periodoDoProjeto(projeto: Projeto): PeriodoProjeto | null {
  const datas: string[] = [];
  for (const faixa of projeto.info?.cronograma?.evento ?? []) {
    const d = (faixa?.data ?? "").trim();
    if (RE_DATA.test(d)) datas.push(d);
  }
  // Projetos anteriores ao cronograma por faixas só têm o campo legado.
  const legado = (projeto.info?.evento ?? "").trim();
  if (!datas.length && RE_DATA.test(legado)) datas.push(legado);
  if (!datas.length) return null;
  datas.sort();
  return { inicio: datas[0], fim: datas[datas.length - 1] };
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
 * Paleta do quadro. Todas as cores têm contraste suficiente para texto branco
 * na barra, e caminham com a marca (o laranja da casa abre a lista).
 */
export const PALETA_CALENDARIO: CorProjeto[] = [
  { forte: "#E36F0A", suave: "#FDF1E3", texto: "#9A4A05" },
  { forte: "#1B4FD1", suave: "#EAF1FE", texto: "#16409F" },
  { forte: "#0E7C50", suave: "#E4F6EE", texto: "#0B5F3D" },
  { forte: "#6D4AE0", suave: "#EFEBFD", texto: "#4F32B8" },
  { forte: "#0E7C8F", suave: "#E3F4F7", texto: "#0A5E6D" },
  { forte: "#C43D6E", suave: "#FBE9F0", texto: "#98284F" },
  { forte: "#5F7C0E", suave: "#F0F5E1", texto: "#47600A" },
  { forte: "#B24B24", suave: "#FBEDE7", texto: "#8A3717" },
  { forte: "#3B4EA0", suave: "#EBEEF9", texto: "#2C3B7C" },
  { forte: "#3A3C44", suave: "#EEEFF2", texto: "#2B2D33" },
];

/**
 * Cor fixa por projeto (hash do id).
 *
 * Precisa ser estável: a mesma cor no card do mês, na barra do detalhamento e
 * na lista é o que deixa a pessoa reconhecer o projeto de longe — se a cor
 * saísse da posição na lista, mudaria a cada filtro aplicado.
 */
export function corDoProjeto(id: string): CorProjeto {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return PALETA_CALENDARIO[h % PALETA_CALENDARIO.length];
}

/* ------------------------------ montagem --------------------------------- */

export interface ProjetoNoCalendario {
  id: string;
  titulo: string;
  cliente: string;
  local: string;
  modalidade: ModalidadeProjeto;
  status: StatusProjeto;
  inicio: string;
  fim: string;
  /** Dias corridos do evento, contando as duas pontas. */
  dias: number;
  cor: CorProjeto;
}

export interface CalendarioProjetos {
  /** Projetos com data de evento — os que o quadro consegue desenhar. */
  itens: ProjetoNoCalendario[];
  /** Projetos sem data de evento, para a tela poder cobrá-los. */
  semData: { id: string; titulo: string; cliente: string }[];
}

const nomeDoProjeto = (p: Projeto) => p.nome || p.info?.titulo || "(projeto sem título)";

/** Converte os projetos do banco no que o quadro precisa, já ordenado por data. */
export function montarCalendario(projetos: Projeto[], ecs: Ec[] = []): CalendarioProjetos {
  const itens: ProjetoNoCalendario[] = [];
  const semData: CalendarioProjetos["semData"] = [];

  for (const p of projetos) {
    const periodo = periodoDoProjeto(p);
    const titulo = nomeDoProjeto(p);
    const cliente = p.cliente?.nome ?? "";
    if (!periodo) {
      semData.push({ id: p.id, titulo, cliente });
      continue;
    }
    itens.push({
      id: p.id,
      titulo,
      cliente,
      local: p.info?.local ?? "",
      modalidade: p.info?.modalidade ?? "",
      status: statusProjetoAutomatico(p, ecs),
      inicio: periodo.inicio,
      fim: periodo.fim,
      dias: duracaoEmDias(periodo),
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
