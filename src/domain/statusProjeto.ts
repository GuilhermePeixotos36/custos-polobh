import type { Ec, Projeto, StatusProjeto } from "@/data/types";

/**
 * Status somente de leitura, derivado do andamento das ECs e da data do evento.
 *
 * As três leituras são as de sempre; só a última precisou de um ajuste de
 * vocabulário. Com dois estados na EC (ver `domain/ec`), 'Cancelada' e
 * 'Aprovada' saíram de circulação:
 *   · "Cancelado" continua aqui para as linhas antigas que ainda tenham o selo,
 *     e simplesmente deixa de acontecer em dado novo — não há mais como cancelar
 *     uma EC, ela é arquivada;
 *   · "Arquivado" é o que sempre foi: o projeto não tem mais nenhuma EC no ar;
 *   · "Concluído" era "o evento passou E alguma EC está Aprovada". Sem o selo
 *     'Aprovada', a leitura equivalente é "o evento passou e a estimativa
 *     continua de pé" — a alternativa seria o status sumir do sistema em
 *     silêncio, e aí sim uma regra teria sido desfeita.
 */
export function statusProjetoAutomatico(projeto: Projeto, ecs: Ec[], hoje = new Date()): StatusProjeto {
  const relacionadas = ecs.filter((ec) => ec.projetoId === projeto.id);
  if (!relacionadas.length) return "Ativo";
  if (relacionadas.every((ec) => ec.status === "Cancelada")) return "Cancelado";
  if (!relacionadas.some((ec) => ec.ativa) && relacionadas.every((ec) => ["Arquivada", "Cancelada"].includes(ec.status))) return "Arquivado";

  const datasEvento = projeto.info.cronograma?.evento?.map((f) => f.data).filter(Boolean) ?? [];
  datasEvento.sort();
  const dataEvento = datasEvento[datasEvento.length - 1] || projeto.info.evento;
  const hojeIso = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  const estimativaDePe = relacionadas.some((ec) => ec.ativa || ec.status === "Aprovada");
  if (dataEvento && dataEvento < hojeIso && estimativaDePe) return "Concluido";
  return "Ativo";
}
