/**
 * As FASES da OS — quem está com o documento, e o que essa pessoa pode mexer.
 *
 * Pedido de 15/09/2026. A OS era um formulário só: quem podia editar editava
 * tudo, em qualquer ordem, e "está pronta para o financeiro" era conversa de
 * corredor. O check-list desenha o caminho que a casa já faz na prática, com
 * dois botões que passam o bastão e geram pendência para quem recebe.
 *
 *   Produção monta  →  Financeiro conclui  →  Back-office emite
 *
 * O que cada fase TRAVA é o ponto. Não é um aviso de "cuidado, já foi para o
 * financeiro": os blocos da fase anterior ficam em leitura, porque o problema
 * que isto resolve é o valor mudando embaixo de quem já o usou para emitir a
 * nota. Voltar é possível e explícito (`devolver`), e fica na auditoria.
 *
 * COMO ISTO CONVERSA COM AS PERMISSÕES. A permissão diz o que a PESSOA pode
 * fazer (`oss.editar`, `financeiro`); a fase diz o que o DOCUMENTO aceita
 * agora. As duas precisam concordar para o campo abrir — e é assim que o pedido
 * "a partir desta etapa a Produção não edita mais" se cumpre sem depender de os
 * sete perfis da Pólobh já existirem no sistema: quem monta a OS tem
 * `oss.editar`, quem conclui tem `financeiro`, e a fase separa os dois momentos.
 */
import type { Os } from "@/data/types";

export type FaseOs = "producao" | "financeiro" | "backoffice" | "emitida";

export const FASES_OS: FaseOs[] = ["producao", "financeiro", "backoffice", "emitida"];

export const ROTULO_FASE: Record<FaseOs, string> = {
  producao: "Com a produção",
  financeiro: "Com o financeiro",
  backoffice: "Com o back-office",
  emitida: "Emitida",
};

/** O que cada fase está esperando — a frase que a tela mostra no topo. */
export const ESPERANDO_FASE: Record<FaseOs, string> = {
  producao: "A produção está montando esta OS.",
  financeiro: "Aguardando a Coordenação Administrativo-Financeira concluir a emissão e o faturamento.",
  backoffice: "Aguardando o Back-office emitir a OS.",
  emitida: "OS emitida.",
};

/** Fase da OS, com o padrão de quem foi gravada antes de as fases existirem. */
export const faseDaOs = (os: Pick<Os, "fase" | "status">): FaseOs => {
  if (os.fase) return os.fase;
  // OS antiga que já saiu da casa não pode aparecer como "a produção está
  // montando": o documento existe do lado do fornecedor.
  return os.status === "Emitida" ? "emitida" : "producao";
};

/**
 * Os blocos que a PRODUÇÃO monta ainda estão abertos?
 *
 * Só na primeira fase. Depois disso o descritivo, os valores e o cronograma
 * viram leitura: eles são a base do que o financeiro usou para emitir a nota, e
 * mudá-los por baixo é o que produz uma OS que se contradiz.
 */
export const editaProducao = (os: Pick<Os, "fase" | "status">): boolean => faseDaOs(os) === "producao";

/**
 * Os blocos do FINANCEIRO estão abertos?
 *
 * Da fase do financeiro em diante — inclusive no back-office, que ainda corrige
 * um código de serviço na hora de emitir. Depois de emitida, não: o documento
 * saiu, e o que muda vira nova versão.
 */
export const editaFinanceiro = (os: Pick<Os, "fase" | "status">): boolean => {
  const fase = faseDaOs(os);
  return fase === "financeiro" || fase === "backoffice";
};

/** A OS já saiu da casa — nada nela se edita, só se gera versão nova. */
export const osEmitida = (os: Pick<Os, "fase" | "status">): boolean => faseDaOs(os) === "emitida";

/** A próxima fase, ou `null` quando não há para onde avançar. */
export const proximaFase = (fase: FaseOs): FaseOs | null => {
  const i = FASES_OS.indexOf(fase);
  return i >= 0 && i < FASES_OS.length - 1 ? FASES_OS[i + 1] : null;
};

/** A fase anterior, para devolver o documento a quem o montou. */
export const faseAnterior = (fase: FaseOs): FaseOs | null => {
  const i = FASES_OS.indexOf(fase);
  return i > 0 ? FASES_OS[i - 1] : null;
};

/**
 * O recurso que responde por cada fase — para quem endereçar a pendência.
 *
 * É por RECURSO, e não por papel ou por pessoa, porque ninguém é nomeado numa
 * passagem de bastão: a OS vai "para o financeiro", não "para a Marisa". Quando
 * os sete perfis da Pólobh estiverem cadastrados como Áreas (Coordenação
 * Administrativo-Financeira, Back-office…), é aqui que o endereço fica mais
 * fino — uma linha, sem tocar no resto.
 */
export const RECURSO_DA_FASE: Partial<Record<FaseOs, "financeiro" | "oss.emitir">> = {
  financeiro: "financeiro",
  // A emissão tem chave própria (`oss.emitir`) desde 16/09/2026. Antes era
  // `oss.editar`, e aí a pendência do back-office caía também em quem só monta
  // a OS — justamente quem esta fase tirou do caminho.
  backoffice: "oss.emitir",
};

/** Quem preenche cada bloco da OS (27/10/2026). */
export type AreaOs = "Produção" | "Financeiro" | "Back-office";

const ETAPA_DA_AREA: Record<AreaOs, FaseOs> = { "Produção": "producao", "Financeiro": "financeiro", "Back-office": "backoffice" };

/**
 * DESTAQUE DOS BLOCOS DA VEZ (27/10/2026). Quem abre a OS quer saber o que
 * preencher AGORA: os blocos da área que está com a OS se destacam; os demais
 * dizem por que estão em leitura. No Back-office os blocos do Financeiro seguem
 * abertos para correção (`editaFinanceiro`), e a frase diz isso.
 */
export function vezDoBloco(area: AreaOs, fase: FaseOs): { vez: boolean; aviso: string } {
  if (fase === "emitida") return { vez: false, aviso: "OS emitida — em leitura" };
  const etapa = ETAPA_DA_AREA[area];
  if (etapa === fase) return { vez: true, aviso: "É a vez deste bloco" };
  // Com o Back-office, tudo segue aberto a ele para correção até a emissão.
  if (fase === "backoffice") return { vez: false, aviso: "Aberto ao Back-office para revisão" };
  return FASES_OS.indexOf(etapa) < FASES_OS.indexOf(fase)
    ? { vez: false, aviso: `${area} já concluiu — em leitura` }
    : { vez: false, aviso: `Abre na etapa do ${area}` };
}

