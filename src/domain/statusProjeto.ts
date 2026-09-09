import type { Ec, Projeto, StatusProjeto } from "@/data/types";

/**
 * Status somente de leitura, derivado do andamento das ECs e da data do evento.
 *
 * A leitura é pela bandeira `ativa`, e não pelo `status` da EC (ver
 * `domain/ec`): a EC tem dois estados, no ar ou no arquivo. Antes isto olhava
 * os selos do antigo fluxo de aprovação — "todas Canceladas" virava projeto
 * Cancelado, e "alguma Aprovada" era o que deixava o projeto Concluído. Com
 * esses selos fora de circulação, as duas leituras passam pela mesma pergunta:
 * ainda existe estimativa valendo neste projeto?
 */
export function statusProjetoAutomatico(projeto: Projeto, ecs: Ec[], hoje = new Date()): StatusProjeto {
  const relacionadas = ecs.filter((ec) => ec.projetoId === projeto.id);
  // Projeto recém-criado, antes da primeira EC: está começando, não acabando.
  if (!relacionadas.length) return "Ativo";
  // Já teve estimativa e não tem nenhuma no ar: o projeto saiu de circulação.
  if (!relacionadas.some((ec) => ec.ativa)) return "Arquivado";

  const datasEvento = projeto.info.cronograma?.evento?.map((f) => f.data).filter(Boolean) ?? [];
  datasEvento.sort();
  const dataEvento = datasEvento[datasEvento.length - 1] || projeto.info.evento;
  const hojeIso = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  // O evento já aconteceu e a estimativa continua de pé: entregue.
  if (dataEvento && dataEvento < hojeIso) return "Concluido";
  return "Ativo";
}
