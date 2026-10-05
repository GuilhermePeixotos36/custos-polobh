/**
 * Check-list (work flow) do projeto — regras de negócio.
 *
 * O módulo transforma o conhecimento operacional da Pólobh em listas padrão por
 * modalidade (Corporativo / Cultural) e, a partir das datas do projeto, calcula
 * a data-limite de cada tarefa. Aqui mora só a matemática e as transições de
 * status; tela e banco ficam de fora, para tudo isto ser testável direto.
 */
import type {
  Checklist,
  EtapaCronogramaProjeto,
  ItemChecklist,
  ItemModeloChecklist,
  ModeloChecklist,
  ModalidadeProjeto,
  Projeto,
  RegraPrazoChecklist,
  StatusChecklist,
} from "@/data/types";

/** Status que encerram o item — saem da visão principal e param de cobrar prazo. */
export const STATUS_ENCERRADOS: StatusChecklist[] = ["Concluído", "Não se aplica"];

export const encerrado = (item: ItemChecklist) => STATUS_ENCERRADOS.includes(item.status);

/* ------------------------------ datas ------------------------------------ */

const MS_DIA = 86400000;

/** Converte "2026-08-23" (ou ISO completo) em Date UTC no início do dia. */
function dia(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Volta ao formato "YYYY-MM-DD" — o mesmo que o resto do app grava. */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(isoData: string, dias: number): string {
  const d = dia(isoData);
  return d ? iso(new Date(d.getTime() + dias * MS_DIA)) : "";
}

/** Dias corridos entre duas datas (b - a). Negativo = b antes de a. */
export function diasEntre(a: string, b: string): number | null {
  const da = dia(a);
  const db = dia(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / MS_DIA);
}

/** Dia da semana de uma data ISO: 0 = domingo … 6 = sábado. */
function diaDaSemana(isoData: string): number {
  return dia(isoData)?.getUTCDay() ?? 0;
}

/** A segunda-feira da semana que contém a data (a semana da Pólobh começa na segunda). */
export function segundaDaSemana(isoData: string): string {
  return somarDias(isoData, -((diaDaSemana(isoData) + 6) % 7));
}

/** Feriados (aaaa-mm-dd) que o motor deve pular, além dos fins de semana. */
export type Feriados = ReadonlySet<string>;

export function ehDiaUtil(isoData: string, feriados?: Feriados): boolean {
  const d = diaDaSemana(isoData);
  return d !== 0 && d !== 6 && !feriados?.has(isoData);
}

/** Soma `n` dias ÚTEIS (n > 0 para frente, n < 0 para trás), pulando fins de semana e feriados. */
export function somarDiasUteis(isoData: string, n: number, feriados?: Feriados): string {
  const passo = n < 0 ? -1 : 1;
  let atual = isoData;
  for (let faltam = Math.abs(n); faltam > 0; ) {
    atual = somarDias(atual, passo);
    if (!atual) return "";
    if (ehDiaUtil(atual, feriados)) faltam--;
  }
  return atual;
}

/** O dia útil mais próximo na direção pedida (a própria data, se já for útil). */
function diaUtilNaDirecao(isoData: string, passo: 1 | -1, feriados?: Feriados): string {
  let atual = isoData;
  // Limite de segurança: nenhum calendário tem 15 dias seguidos sem dia útil.
  for (let i = 0; i < 15 && atual && !ehDiaUtil(atual, feriados); i++) atual = somarDias(atual, passo);
  return atual;
}

/** Primeiro e último dia de uma etapa do cronograma do projeto. */
export interface FaixaDeDatas {
  inicio: string;
  fim: string;
}

/**
 * Janela do projeto usada pelo motor de prazos.
 *
 * `inicio` e `fim` delimitam o período completo (pré-evento → pós-evento) e
 * `evento` é a âncora do dia D. Quando o projeto ainda não tem alguma das datas,
 * o motor degrada com elegância: sem janela não há régua percentual, sem evento
 * não há âncora — e o item simplesmente nasce sem data-limite, para ser
 * preenchido à mão.
 *
 * Os campos opcionais alimentam as réguas da lista padrão da Pólobh:
 *  - `criacao` é o dia em que o projeto nasceu — o começo da janela em que as
 *    tarefas "semanas antes do evento" precisam caber;
 *  - `etapas` são as datas de trabalho do cronograma (montagem, evento…);
 *  - `semanasReferencia` é o prazo "de manual" da lista (a tarefa mais
 *    antecipada dela, em semanas) — a escala que se estica ou se comprime;
 *  - `feriados` entra na contagem de dias úteis.
 */
export interface JanelaProjeto {
  inicio: string;
  evento: string;
  fim: string;
  criacao?: string;
  etapas?: Partial<Record<EtapaCronogramaProjeto, FaixaDeDatas>>;
  semanasReferencia?: number;
  feriados?: Feriados;
}

const ETAPAS_DO_CRONOGRAMA: EtapaCronogramaProjeto[] = [
  "montagem",
  "alinhamentos",
  "ensaios",
  "evento",
  "desmontagem",
];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Primeiro e último dia preenchidos de cada etapa do cronograma. */
function etapasDoCronograma(projeto: Projeto): Partial<Record<EtapaCronogramaProjeto, FaixaDeDatas>> {
  const out: Partial<Record<EtapaCronogramaProjeto, FaixaDeDatas>> = {};
  for (const etapa of ETAPAS_DO_CRONOGRAMA) {
    const datas = (projeto.info.cronograma?.[etapa] ?? [])
      .map((f) => (f?.data ?? "").trim())
      .filter((d) => RE_DATA.test(d))
      .sort();
    if (datas.length) out[etapa] = { inicio: datas[0], fim: datas[datas.length - 1] };
  }
  return out;
}

/**
 * A "semana de referência" de uma lista padrão: a tarefa MAIS ANTECIPADA que se
 * adapta (`semanas-antes` sem `fixo`). É a medida do prazo de manual — a lista
 * da Pólobh foi pensada para 11 semanas (Cultural) ou 6 (Corporativo) — e
 * sai das próprias tarefas, então editar a lista em Configurações recalibra o
 * motor sem mais nenhum ajuste.
 */
export function semanasDeReferencia(modelo: ModeloChecklist | undefined): number {
  let maior = 0;
  for (const m of modelo?.itens ?? []) {
    if (m.prazo.modo === "semanas-antes" && !m.prazo.fixo) maior = Math.max(maior, m.prazo.semanas ?? 0);
  }
  return maior;
}

/**
 * Lê a janela a partir do projeto.
 *
 * As três datas do projeto (pré-evento, evento, pós-evento) nem sempre estão
 * todas preenchidas; o que existir é aproveitado, com o dia do evento servindo
 * de tampão nas pontas — um projeto que só tem a data do evento ainda consegue
 * posicionar as tarefas ancoradas.
 */
export function janelaDoProjeto(
  projeto: Projeto,
  opcoes: { modelo?: ModeloChecklist; feriados?: Feriados; hoje?: string } = {}
): JanelaProjeto {
  const { preEvento, evento, posEvento } = projeto.info;
  return {
    inicio: preEvento || evento || "",
    evento: evento || preEvento || posEvento || "",
    fim: posEvento || evento || "",
    // O dia em que o projeto foi criado, como a pessoa o viu no relógio. Sem
    // `criadoEm` (projeto ainda em memória), vale o dia de hoje.
    criacao: dataLocalDe(projeto.criadoEm) || opcoes.hoje || "",
    etapas: etapasDoCronograma(projeto),
    semanasReferencia: semanasDeReferencia(opcoes.modelo),
    feriados: opcoes.feriados,
  };
}

const ROTULO_ETAPA_CRONOGRAMA: Record<EtapaCronogramaProjeto, string> = {
  montagem: "montagem",
  alinhamentos: "alinhamentos/testes",
  ensaios: "ensaios",
  evento: "evento",
  desmontagem: "desmontagem",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A régua em português, para a tela de Configurações mostrar o que ela faz. */
export function descreverPrazo(prazo: RegraPrazoChecklist): string {
  switch (prazo.modo) {
    case "semanas-antes": {
      const n = prazo.semanas ?? 1;
      const onde = n === 0 ? "da semana do evento" : n === 1 ? "da semana anterior ao evento" : `da ${n}ª semana antes do evento`;
      return prazo.fixo
        ? `Vence na segunda-feira ${onde} — NÃO se adapta ao prazo do projeto.`
        : `Vence na segunda-feira ${onde} (prazo de manual). Se o projeto for criado com menos — ou mais — tempo, a tarefa se encaixa na janela mantendo a proporção.`;
    }
    case "cronograma": {
      const etapa = ROTULO_ETAPA_CRONOGRAMA[prazo.etapa ?? "evento"];
      const reserva = prazo.ou ? ` (sem ${etapa}, usa ${ROTULO_ETAPA_CRONOGRAMA[prazo.ou]})` : "";
      return `Puxa do cronograma do projeto: ${(prazo.ponta ?? "ultima") === "primeira" ? "primeiro" : "último"} dia de ${etapa}${reserva}.`;
    }
    case "dias-uteis-apos":
      return `Vence ${plural(prazo.diasUteis ?? 1, "dia útil", "dias úteis")} após ${(prazo.base ?? "desmontagem") === "desmontagem" ? "a desmontagem" : "o evento"}.`;
    case "semanas-apos":
      return `Vence na segunda-feira da ${plural(prazo.semanas ?? 1, "semana", "semanas")} após o evento.`;
    case "ancora": {
      const d = prazo.diasDoEvento ?? 0;
      return d < 0 ? `Vence ${Math.abs(d)} dia(s) ANTES do evento.` : d === 0 ? "Vence no dia do evento." : `Vence ${d} dia(s) DEPOIS do evento.`;
    }
    default:
      return `Vence a ${Math.round((prazo.percentual ?? 0) * 100)}% do período do projeto.`;
  }
}

/**
 * "Segunda-feira da Nª semana antes do evento" — a régua que se adapta.
 *
 * O prazo de manual da lista (N semanas, a mais antecipada delas sendo
 * `semanasReferencia`) pressupõe que o projeto nasce com tempo de sobra. Na
 * prática há evento criado a 5 meses e evento criado a 9 dias. Então a lista é
 * tratada como uma ESCALA, não como datas:
 *
 *   1. mede-se a janela real: do dia em que o projeto foi criado até o evento;
 *   2. mede-se a janela de manual: da segunda-feira da semana mais antecipada
 *      até o evento;
 *   3. cada tarefa mantém a MESMA FRAÇÃO da janela que tinha no manual — se ela
 *      vencia a 40% do caminho, continua vencendo a 40%, só que de uma janela
 *      maior (estica) ou menor (comprime).
 *
 * É a proporcionalidade pedida: a distância entre as tarefas muda, a ordem e o
 * peso relativo de cada uma, não. Com a janela igual à de manual, o resultado
 * é exatamente a segunda-feira que a lista escreve.
 *
 * Fim de semana e feriado não são prazo: a data cai no dia útil ANTERIOR (o
 * prazo nunca atrasa por arredondamento) — ou no seguinte, se o anterior
 * ficaria antes do nascimento do projeto.
 */
function dataSemanasAntes(prazo: RegraPrazoChecklist, janela: JanelaProjeto): string {
  if (!janela.evento) return "";
  const semanas = Math.max(0, prazo.semanas ?? 1);
  const dataDeManual = somarDias(segundaDaSemana(janela.evento), -7 * semanas);
  const referencia = janela.semanasReferencia ?? 0;
  const inicio = janela.criacao ?? "";

  if (prazo.fixo || !referencia || !inicio) return diaUtilNaDirecao(dataDeManual, -1, janela.feriados);

  const janelaReal = diasEntre(inicio, janela.evento);
  const janelaDeManual = diasEntre(somarDias(segundaDaSemana(janela.evento), -7 * referencia), janela.evento);
  // Projeto criado no dia do evento (ou depois): não há janela a distribuir.
  if (janelaReal === null || janelaReal <= 0 || !janelaDeManual) return janela.evento;

  const distanciaDeManual = diasEntre(dataDeManual, janela.evento) ?? 0;
  const proporcional = somarDias(janela.evento, -Math.round((distanciaDeManual * janelaReal) / janelaDeManual));

  const anterior = diaUtilNaDirecao(proporcional, -1, janela.feriados);
  return anterior && anterior >= inicio ? anterior : diaUtilNaDirecao(proporcional, 1, janela.feriados);
}

/** Data de trabalho puxada do cronograma do projeto. */
function dataDoCronograma(prazo: RegraPrazoChecklist, janela: JanelaProjeto): string {
  const etapa = prazo.etapa ?? "evento";
  const faixa = janela.etapas?.[etapa] ?? (prazo.ou ? janela.etapas?.[prazo.ou] : undefined);
  if (faixa) return (prazo.ponta ?? "ultima") === "primeira" ? faixa.inicio : faixa.fim;
  // Projeto só com a data legada do evento: serve para a etapa "evento".
  return etapa === "evento" || prazo.ou === "evento" ? janela.evento : "";
}

/** O último dia de trabalho da base ("evento" ou "desmontagem") das réguas pós-evento. */
function ultimoDiaDaBase(base: "evento" | "desmontagem", janela: JanelaProjeto): string {
  const desmontagem = janela.etapas?.desmontagem?.fim ?? "";
  const evento = janela.etapas?.evento?.fim || janela.evento;
  return base === "desmontagem" ? desmontagem || evento : evento;
}

/**
 * Data-limite de uma tarefa dentro da janela do projeto.
 *
 * Percentual: distribui no período completo (0 = início, 1 = fim). Âncora: fixa
 * a tarefa a N dias do evento. As réguas da lista padrão da Pólobh estão
 * descritas em `ModoPrazoChecklist`. Devolve "" quando falta a data que a régua
 * precisa — nunca inventa um prazo em cima de projeto sem data.
 */
export function calcularDataLimite(prazo: RegraPrazoChecklist, janela: JanelaProjeto): string {
  switch (prazo.modo) {
    case "ancora":
      if (!janela.evento) return "";
      return somarDias(janela.evento, prazo.diasDoEvento ?? 0);
    case "semanas-antes":
      return dataSemanasAntes(prazo, janela);
    case "cronograma":
      return dataDoCronograma(prazo, janela);
    case "dias-uteis-apos": {
      const base = ultimoDiaDaBase(prazo.base ?? "desmontagem", janela);
      return base ? somarDiasUteis(base, Math.max(0, prazo.diasUteis ?? 1), janela.feriados) : "";
    }
    case "semanas-apos": {
      const base = ultimoDiaDaBase(prazo.base ?? "evento", janela);
      const segunda = base ? somarDias(segundaDaSemana(base), 7 * Math.max(0, prazo.semanas ?? 1)) : "";
      return segunda ? diaUtilNaDirecao(segunda, 1, janela.feriados) : "";
    }
    default: {
      const total = diasEntre(janela.inicio, janela.fim);
      if (total === null || !janela.inicio) return "";
      const fracao = Math.min(1, Math.max(0, prazo.percentual ?? 0));
      // Projeto de um dia só (total = 0) resolve tudo no próprio dia.
      return somarDias(janela.inicio, Math.round(total * fracao));
    }
  }
}

/* --------------------------- geração e sincronia -------------------------- */

/** A função da lista que é, na prática, a pessoa cadastrada como produtora do projeto. */
export const FUNCAO_PRODUCAO_RESPONSAVEL = "Produção Responsável";

/** Gera o id de um item novo — isolado para o teste poder injetar um previsível. */
export type GeradorId = () => string;

const idPadrao: GeradorId = () =>
  globalThis.crypto?.randomUUID?.() ?? `item-${Math.round(performance.now() * 1000)}`;

/**
 * Instancia o check-list de um projeto a partir do modelo da sua modalidade.
 *
 * Todo item nasce "Pendente" e visível, com a data-limite já calculada — é o
 * comportamento pedido no briefing. O vínculo `origemModeloItemId` fica gravado
 * para a sincronização posterior saber o que veio do modelo e o que foi criado
 * à mão dentro do projeto.
 */
export function gerarChecklist(
  projeto: Projeto,
  modelo: ModeloChecklist,
  novoId: GeradorId = idPadrao,
  feriados?: Feriados
): Checklist {
  const janela = janelaDoProjeto(projeto, { modelo, feriados });
  const agora = new Date().toISOString();
  const checklistId = novoId();
  const itens = [...modelo.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((molde, indice) => itemDoModelo(molde, checklistId, janela, indice, novoId, projeto));
  return {
    id: checklistId,
    projetoId: projeto.id,
    modalidade: modelo.modalidade,
    modeloId: modelo.id,
    itens,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function itemDoModelo(
  molde: ItemModeloChecklist,
  checklistId: string,
  janela: JanelaProjeto,
  ordem: number,
  novoId: GeradorId,
  projeto?: Projeto
): ItemChecklist {
  // "Produção Responsável" não é uma pessoa qualquer: é a produtora do projeto,
  // que já está em Dados Gerais. A tarefa nasce com ela como dona.
  const produtora = projeto?.info.produtoraResponsavel?.trim() ?? "";
  const responsavel =
    molde.responsavelPadrao || (produtora && molde.funcoes?.includes(FUNCAO_PRODUCAO_RESPONSAVEL) ? produtora : "");
  return {
    id: novoId(),
    checklistId,
    origemModeloItemId: molde.id,
    titulo: molde.titulo,
    descricao: molde.descricao,
    etapa: molde.etapa,
    status: "Pendente",
    dataLimite: calcularDataLimite(molde.prazo, janela),
    dataManual: false,
    concluidoEm: "",
    concluidoPor: "",
    responsavel,
    funcoes: [...(molde.funcoes ?? [])],
    observacoes: [],
    oculto: false,
    ordem,
  };
}

/**
 * Recalcula as datas-limite depois que as datas do projeto mudam.
 *
 * Preserva duas coisas de propósito: o item com `dataManual` (alguém já ajustou
 * aquela data e a régua não pode passar por cima) e o item já encerrado (mexer
 * no prazo de tarefa concluída só embaralharia o histórico).
 */
export function recalcularPrazos(
  checklist: Checklist,
  projeto: Projeto,
  modelo: ModeloChecklist | undefined,
  feriados?: Feriados
): Checklist {
  const janela = janelaDoProjeto(projeto, { modelo, feriados });
  const prazoPorModeloItem = new Map((modelo?.itens ?? []).map((m) => [m.id, m.prazo]));
  const itens = checklist.itens.map((item) => {
    if (item.dataManual || encerrado(item)) return item;
    const prazo = prazoPorModeloItem.get(item.origemModeloItemId);
    if (!prazo) return item; // item criado à mão: sem régua, mantém a data que tem
    const dataLimite = calcularDataLimite(prazo, janela);
    return dataLimite && dataLimite !== item.dataLimite ? { ...item, dataLimite } : item;
  });
  return { ...checklist, itens };
}

/**
 * Traz para um check-list já existente os itens que foram acrescentados ao
 * modelo depois que ele foi gerado.
 *
 * Alterar a lista padrão NÃO reescreve os check-lists em andamento — isso
 * apagaria o trabalho da equipe no meio do projeto. Esta função é o caminho
 * explícito: acrescenta só o que falta, mantendo intacto tudo o que já existe.
 */
export function sincronizarComModelo(
  checklist: Checklist,
  projeto: Projeto,
  modelo: ModeloChecklist,
  novoId: GeradorId = idPadrao,
  feriados?: Feriados
): { checklist: Checklist; adicionados: number } {
  const janela = janelaDoProjeto(projeto, { modelo, feriados });
  const jaTem = new Set(checklist.itens.map((i) => i.origemModeloItemId).filter(Boolean));
  const novos = [...modelo.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((m) => !jaTem.has(m.id));
  if (!novos.length) return { checklist, adicionados: 0 };
  let ordem = checklist.itens.reduce((max, i) => Math.max(max, i.ordem), -1);
  const acrescentados = novos.map((m) => itemDoModelo(m, checklist.id, janela, ++ordem, novoId, projeto));
  return {
    checklist: { ...checklist, itens: [...checklist.itens, ...acrescentados] },
    adicionados: acrescentados.length,
  };
}

/* ------------------------------- transições ------------------------------- */

/**
 * Aplica a mudança de status de um item.
 *
 * "Concluído" carimba data e autor e recolhe o item da visão principal — a
 * ocultação automática pedida no briefing. Voltar o item para aberto desfaz as
 * três coisas, senão ele reapareceria já marcado como concluído por alguém.
 */
export function definirStatus(
  item: ItemChecklist,
  status: StatusChecklist,
  porQuem: string,
  agoraIso: string
): ItemChecklist {
  if (item.status === status) return item;
  if (status === "Concluído") {
    return { ...item, status, concluidoEm: agoraIso, concluidoPor: porQuem, oculto: true };
  }
  if (status === "Não se aplica") {
    return { ...item, status, concluidoEm: "", concluidoPor: "", oculto: true };
  }
  return { ...item, status, concluidoEm: "", concluidoPor: "", oculto: false };
}

/* --------------------------- data de conclusão ---------------------------- */

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Dia LOCAL de um instante (YYYY-MM-DD) — o dia que a pessoa viu no relógio.
 *
 * `concluidoEm` guarda o instante em UTC. Uma tarefa concluída às 21h no
 * Brasil já é o dia seguinte em UTC, então ler os dez primeiros caracteres do
 * ISO daria o dia errado em toda conclusão do fim da tarde.
 */
export function dataLocalDe(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Valor de `concluidoEm` no formato de um <input type="datetime-local">. */
export function paraCampoDataHora(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dataLocalDe(iso)}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/**
 * Grava o instante em que a tarefa foi REALMENTE concluída — data e hora.
 *
 * O carimbo normal é automático (sai no momento do clique, com a hora exata),
 * mas a realidade atrasa o registro: a pessoa termina na sexta às 18h e só marca
 * no sistema na segunda. Poder corrigir é o que mantém o histórico fiel — e é
 * dessa data que sai a leitura de "saiu no prazo ou não".
 *
 * Recebe o valor como o campo da tela entrega: "YYYY-MM-DDTHH:mm" em horário
 * LOCAL. Guarda em UTC, que é o formato da coluna timestamptz.
 */
export function definirDataConclusao(item: ItemChecklist, valorLocal: string): ItemChecklist {
  if (!valorLocal) return { ...item, concluidoEm: "" };
  // Só a data (sem hora): assume meio-dia, para não cair na virada do dia.
  const bruto = valorLocal.length <= 10 ? `${valorLocal}T12:00` : valorLocal;
  const d = new Date(bruto); // sem sufixo Z, o JS lê como horário local
  if (Number.isNaN(d.getTime())) return item;
  return { ...item, concluidoEm: d.toISOString() };
}

/**
 * Dias entre o prazo e a conclusão real.
 *
 * Positivo = concluiu depois do prazo (atraso); zero ou negativo = saiu no
 * prazo. Compara pelo DIA LOCAL da conclusão: quem terminou às 22h do dia do
 * prazo entregou no prazo, ainda que em UTC já fosse o dia seguinte.
 */
export function atrasoNaConclusao(item: ItemChecklist): number | null {
  if (!item.concluidoEm || !item.dataLimite) return null;
  return diasEntre(item.dataLimite, dataLocalDe(item.concluidoEm));
}

/* -------------------------------- situação -------------------------------- */

/** Como o item está em relação ao prazo — base dos badges e das pendências. */
export type SituacaoPrazo = "sem-data" | "encerrado" | "atrasado" | "hoje" | "proximo" | "em-dia";

/** Dias de antecedência a partir dos quais o item já entra no radar da equipe. */
export const DIAS_ALERTA = 3;

export function situacaoPrazo(item: ItemChecklist, hojeIso: string): SituacaoPrazo {
  if (encerrado(item)) return "encerrado";
  if (!item.dataLimite) return "sem-data";
  const faltam = diasEntre(hojeIso, item.dataLimite);
  if (faltam === null) return "sem-data";
  if (faltam < 0) return "atrasado";
  if (faltam === 0) return "hoje";
  return faltam <= DIAS_ALERTA ? "proximo" : "em-dia";
}

/** Resumo do check-list para o cabeçalho da tela e para a lista de projetos. */
export interface ResumoChecklist {
  total: number;
  /** Tarefas que contam para o progresso (exclui as marcadas "Não se aplica"). */
  contam: number;
  concluidos: number;
  abertos: number;
  atrasados: number;
  proximos: number;
  /** 0 a 1 — concluídos sobre o que de fato conta (exclui "Não se aplica"). */
  progresso: number;
}

export function resumirChecklist(checklist: Checklist | undefined, hojeIso: string): ResumoChecklist {
  const itens = checklist?.itens ?? [];
  const contam = itens.filter((i) => i.status !== "Não se aplica");
  const concluidos = contam.filter((i) => i.status === "Concluído").length;
  const abertos = itens.filter((i) => !encerrado(i));
  const situacoes = abertos.map((i) => situacaoPrazo(i, hojeIso));
  return {
    total: itens.length,
    contam: contam.length,
    concluidos,
    abertos: abertos.length,
    atrasados: situacoes.filter((s) => s === "atrasado").length,
    proximos: situacoes.filter((s) => s === "hoje" || s === "proximo").length,
    progresso: contam.length ? concluidos / contam.length : 0,
  };
}

/**
 * Ordena os itens do jeito que a equipe lê: por data-limite (o que vence antes
 * vem primeiro), com os sem data no fim e a ordem do modelo como desempate.
 */
export function ordenarPorPrazo(itens: ItemChecklist[]): ItemChecklist[] {
  return [...itens].sort((a, b) => {
    if (!a.dataLimite && !b.dataLimite) return a.ordem - b.ordem;
    if (!a.dataLimite) return 1;
    if (!b.dataLimite) return -1;
    return a.dataLimite.localeCompare(b.dataLimite) || a.ordem - b.ordem;
  });
}

/** Agrupa por data-limite — base da visão cronológica ("indexado por data"). */
export function agruparPorData(itens: ItemChecklist[]): { data: string; itens: ItemChecklist[] }[] {
  const mapa = new Map<string, ItemChecklist[]>();
  for (const item of ordenarPorPrazo(itens)) {
    const chave = item.dataLimite || "";
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(item);
  }
  return [...mapa.entries()].map(([data, lista]) => ({ data, itens: lista }));
}

/** Modelo da modalidade do projeto (a lista padrão que deve alimentá-lo). */
export function modeloDaModalidade(
  modelos: ModeloChecklist[],
  modalidade: ModalidadeProjeto
): ModeloChecklist | undefined {
  return modelos.find((m) => m.modalidade === modalidade);
}

/* ---------------------- ordem das etapas e das tarefas --------------------- */

/**
 * A ETAPA de uma tarefa. Tarefa sem etapa cai em "OUTROS" — o mesmo nome que a
 * tela mostra. É a chave do grupo; ao gravar, "OUTROS" volta a ser etapa vazia.
 */
export const SEM_ETAPA = "OUTROS";
export const chaveEtapa = (item: ItemChecklist): string => item.etapa || SEM_ETAPA;

export interface GrupoEtapa {
  chave: string;
  itens: ItemChecklist[];
}

/**
 * As etapas na ordem do processo, cada uma com as suas tarefas na ordem em que
 * foram arrumadas. Considera TODAS as tarefas (inclusive as recolhidas): mover
 * uma etapa leva consigo o que está escondido nela.
 *
 * A ordem das etapas não é um registro à parte — ela sai da ordem das tarefas
 * (`item.ordem`): a etapa vem na posição da sua primeira tarefa.
 */
export function gruposDeEtapa(itens: ItemChecklist[]): GrupoEtapa[] {
  const grupos: GrupoEtapa[] = [];
  for (const item of [...itens].sort((a, b) => a.ordem - b.ordem)) {
    const chave = chaveEtapa(item);
    let grupo = grupos.find((g) => g.chave === chave);
    if (!grupo) grupos.push((grupo = { chave, itens: [] }));
    grupo.itens.push(item);
  }
  return grupos;
}

/** Reescreve `ordem` e `etapa` conforme os grupos, devolvendo SÓ o que mudou. */
function renumerar(originais: ItemChecklist[], grupos: GrupoEtapa[]): ItemChecklist[] {
  const antes = new Map(originais.map((i) => [i.id, i]));
  const mudaram: ItemChecklist[] = [];
  let n = 0;
  for (const grupo of grupos) {
    const etapa = grupo.chave === SEM_ETAPA ? "" : grupo.chave;
    for (const item of grupo.itens) {
      const ordem = n++;
      const original = antes.get(item.id);
      if (!original || original.ordem !== ordem || original.etapa !== etapa) {
        mudaram.push({ ...item, ordem, etapa });
      }
    }
  }
  return mudaram;
}

function arrayMove<T>(lista: T[], de: number, para: number): T[] {
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(para, 0, x);
  return copia;
}

/**
 * Move a tarefa para a posição de OUTRA (`sobreId`) — no mesmo grupo ou em outro
 * (é o que o arraste e as setas fazem). Devolve as tarefas que mudaram de ordem
 * ou de etapa, prontas para gravar.
 */
export function moverItemSobre(itens: ItemChecklist[], itemId: string, sobreId: string): ItemChecklist[] {
  if (itemId === sobreId) return [];
  const grupos = gruposDeEtapa(itens);
  const gOrigem = grupos.find((g) => g.itens.some((i) => i.id === itemId));
  const gAlvo = grupos.find((g) => g.itens.some((i) => i.id === sobreId));
  if (!gOrigem || !gAlvo) return [];
  const de = gOrigem.itens.findIndex((i) => i.id === itemId);
  const para = gAlvo.itens.findIndex((i) => i.id === sobreId);
  if (gOrigem === gAlvo) {
    gOrigem.itens = arrayMove(gOrigem.itens, de, para);
  } else {
    const [item] = gOrigem.itens.splice(de, 1);
    gAlvo.itens.splice(para, 0, item);
  }
  return renumerar(itens, grupos.filter((g) => g.itens.length));
}

/** Move a tarefa para o começo ou o fim de uma etapa (criando a etapa, se preciso). */
export function moverItemParaEtapa(
  itens: ItemChecklist[],
  itemId: string,
  chaveDestino: string,
  posicao: "inicio" | "fim" = "fim"
): ItemChecklist[] {
  const grupos = gruposDeEtapa(itens);
  const gOrigem = grupos.find((g) => g.itens.some((i) => i.id === itemId));
  if (!gOrigem) return [];
  const [item] = gOrigem.itens.splice(gOrigem.itens.findIndex((i) => i.id === itemId), 1);
  let gDestino = grupos.find((g) => g.chave === chaveDestino);
  if (!gDestino) grupos.push((gDestino = { chave: chaveDestino, itens: [] }));
  if (posicao === "inicio") gDestino.itens.unshift(item);
  else gDestino.itens.push(item);
  return renumerar(itens, grupos.filter((g) => g.itens.length));
}

/**
 * As setas: sobem/descem a tarefa uma posição ENTRE AS QUE ESTÃO À VISTA
 * (`visiveis`, na ordem da tela, da mesma etapa) e, na borda da etapa, atravessam
 * para a vizinha — a primeira sobe para o fim da etapa de cima, a última desce
 * para o começo da de baixo.
 */
export function moverItemPorSeta(
  itens: ItemChecklist[],
  itemId: string,
  direcao: -1 | 1,
  visiveis: string[] = []
): ItemChecklist[] {
  const grupos = gruposDeEtapa(itens);
  const indiceGrupo = grupos.findIndex((g) => g.itens.some((i) => i.id === itemId));
  if (indiceGrupo < 0) return [];
  const grupo = grupos[indiceGrupo];
  const naEtapa = visiveis.length ? grupo.itens.filter((i) => visiveis.includes(i.id)) : grupo.itens;
  const pos = naEtapa.findIndex((i) => i.id === itemId);
  const vizinha = naEtapa[pos + direcao];
  if (vizinha) return moverItemSobre(itens, itemId, vizinha.id);
  const outra = grupos[indiceGrupo + direcao];
  if (!outra) return [];
  return moverItemParaEtapa(itens, itemId, outra.chave, direcao === -1 ? "fim" : "inicio");
}

/** Move a ETAPA inteira para a posição de outra, levando as tarefas dela. */
export function moverEtapaSobre(itens: ItemChecklist[], chave: string, sobreChave: string): ItemChecklist[] {
  if (chave === sobreChave) return [];
  const grupos = gruposDeEtapa(itens);
  const de = grupos.findIndex((g) => g.chave === chave);
  const para = grupos.findIndex((g) => g.chave === sobreChave);
  if (de < 0 || para < 0) return [];
  return renumerar(itens, arrayMove(grupos, de, para));
}

/**
 * O status como a coluna "Status" o mostra: Pendente, Atrasado ou Concluído
 * (mais "Não se aplica", que é a tarefa fora do jogo). "Atrasado" não é um
 * estado gravado — sai do prazo vencido de uma tarefa ainda aberta —, e
 * "Em andamento" aparece como Pendente: para a coluna, tudo o que não acabou.
 */
export type StatusExibido = "Pendente" | "Atrasado" | "Concluído" | "Não se aplica";

export function statusExibido(item: ItemChecklist, hojeIso: string): StatusExibido {
  if (item.status === "Concluído") return "Concluído";
  if (item.status === "Não se aplica") return "Não se aplica";
  return situacaoPrazo(item, hojeIso) === "atrasado" ? "Atrasado" : "Pendente";
}
