import type { Ec, Projeto, StatusProjeto } from "@/data/types";

/**
 * Status somente de leitura: o projeto está no ar, ou está no arquivo.
 *
 * DOIS estados, e só eles (15/09/2026). A EC já tinha feito essa redução em
 * 09/09 — "esta é a estimativa que vale, ou não é?" —, e a Pólobh pediu a mesma
 * régua para o resto: *"todo o sistema deverá considerar somente os rótulos
 * Ativo ou Arquivado para todos os documentos"*.
 *
 * O que saiu, e por quê:
 *   · "Concluído" era "o evento passou e a estimativa continua de pé". Ele
 *     descrevia o CALENDÁRIO, não o andamento do trabalho: um evento realizado
 *     ontem costuma ter nota para emitir, acerto para fechar e fornecedor para
 *     pagar — nada nele está concluído. Pior, o selo encerrava as pendências
 *     sozinho, e o que ficava por fazer sumia do quadro na virada da data;
 *   · "Cancelado" já não acontecia: desde 09/09 não há como cancelar uma EC,
 *     ela é arquivada.
 *
 * A consequência a conhecer: ARQUIVAR PASSA A SER GESTO DE GENTE. O projeto do
 * evento que já passou continua ativo — e continua cobrando — até alguém
 * arquivá-lo. É por isso que existe `eventoEncerradoHaDias`, abaixo: a tela
 * lembra, em vez de o sistema decidir sozinho.
 */
export function statusProjetoAutomatico(projeto: Projeto, ecs: Ec[]): StatusProjeto {
  const relacionadas = ecs.filter((ec) => ec.projetoId === projeto.id);
  if (!relacionadas.length) return "Ativo";
  // Sem nenhuma EC no ar, o projeto está no arquivo. (EC 'Cancelada' é dado
  // antigo: o vocabulário da EC tem só Ativa e Arquivada desde 09/09/2026.)
  if (!relacionadas.some((ec) => ec.ativa) && relacionadas.every((ec) => ["Arquivada", "Cancelada"].includes(ec.status))) {
    return "Arquivado";
  }
  return "Ativo";
}

/**
 * Há quantos dias o evento terminou — ou `null` se ele ainda não aconteceu.
 *
 * Existe porque "Concluído" saiu: sem um estado que se acendesse sozinho, o
 * projeto de um evento realizado continuaria ativo para sempre, cobrando a
 * equipe, até alguém lembrar de arquivá-lo. A tela usa isto para sugerir o
 * arquivamento — sugerir, não fazer: fechar um projeto é decisão de quem sabe
 * se ainda falta nota, acerto ou pagamento.
 */
export function eventoEncerradoHaDias(projeto: Projeto, hoje = new Date()): number | null {
  const datasEvento = projeto.info?.cronograma?.evento?.map((f) => f.data).filter(Boolean) ?? [];
  datasEvento.sort();
  const fim = datasEvento[datasEvento.length - 1] || projeto.info?.evento;
  if (!fim) return null;
  const hojeIso = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  if (fim >= hojeIso) return null;
  const dia = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${hojeIso}T00:00:00`).getTime() - new Date(`${fim}T00:00:00`).getTime()) / dia);
}
