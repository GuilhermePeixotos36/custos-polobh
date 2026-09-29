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

/**
 * Janela do projeto usada pelo motor de prazos.
 *
 * `inicio` e `fim` delimitam o período completo (pré-evento → pós-evento) e
 * `evento` é a âncora do dia D. Quando o projeto ainda não tem alguma das datas,
 * o motor degrada com elegância: sem janela não há régua percentual, sem evento
 * não há âncora — e o item simplesmente nasce sem data-limite, para ser
 * preenchido à mão.
 */
export interface JanelaProjeto {
  inicio: string;
  evento: string;
  fim: string;
}

/**
 * Lê a janela a partir do projeto.
 *
 * As três datas do projeto (pré-evento, evento, pós-evento) nem sempre estão
 * todas preenchidas; o que existir é aproveitado, com o dia do evento servindo
 * de tampão nas pontas — um projeto que só tem a data do evento ainda consegue
 * posicionar as tarefas ancoradas.
 */
export function janelaDoProjeto(projeto: Projeto): JanelaProjeto {
  const { preEvento, evento, posEvento } = projeto.info;
  return {
    inicio: preEvento || evento || "",
    evento: evento || preEvento || posEvento || "",
    fim: posEvento || evento || "",
  };
}

/**
 * Data-limite de uma tarefa dentro da janela do projeto.
 *
 * Percentual: distribui no período completo (0 = início, 1 = fim). Âncora: fixa
 * a tarefa a N dias do evento. Devolve "" quando falta a data que a régua
 * precisa — nunca inventa um prazo em cima de projeto sem data.
 */
export function calcularDataLimite(prazo: RegraPrazoChecklist, janela: JanelaProjeto): string {
  if (prazo.modo === "ancora") {
    if (!janela.evento) return "";
    return somarDias(janela.evento, prazo.diasDoEvento ?? 0);
  }
  const total = diasEntre(janela.inicio, janela.fim);
  if (total === null || !janela.inicio) return "";
  const fracao = Math.min(1, Math.max(0, prazo.percentual ?? 0));
  // Projeto de um dia só (total = 0) resolve tudo no próprio dia.
  return somarDias(janela.inicio, Math.round(total * fracao));
}

/* --------------------------- geração e sincronia -------------------------- */

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
  novoId: GeradorId = idPadrao
): Checklist {
  const janela = janelaDoProjeto(projeto);
  const agora = new Date().toISOString();
  const checklistId = novoId();
  const itens = [...modelo.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((molde, indice) => itemDoModelo(molde, checklistId, janela, indice, novoId));
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
  novoId: GeradorId
): ItemChecklist {
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
    responsavel: molde.responsavelPadrao,
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
  modelo: ModeloChecklist | undefined
): Checklist {
  const janela = janelaDoProjeto(projeto);
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
  novoId: GeradorId = idPadrao
): { checklist: Checklist; adicionados: number } {
  const janela = janelaDoProjeto(projeto);
  const jaTem = new Set(checklist.itens.map((i) => i.origemModeloItemId).filter(Boolean));
  const novos = [...modelo.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((m) => !jaTem.has(m.id));
  if (!novos.length) return { checklist, adicionados: 0 };
  let ordem = checklist.itens.reduce((max, i) => Math.max(max, i.ordem), -1);
  const acrescentados = novos.map((m) => itemDoModelo(m, checklist.id, janela, ++ordem, novoId));
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
