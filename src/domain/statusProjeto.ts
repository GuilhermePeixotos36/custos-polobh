import type { Ec, Projeto, StatusProjeto } from "@/data/types";

/** Status somente de leitura, derivado do andamento das ECs e da data do evento. */
export function statusProjetoAutomatico(projeto: Projeto, ecs: Ec[], hoje = new Date()): StatusProjeto {
  const relacionadas = ecs.filter((ec) => ec.projetoId === projeto.id);
  if (!relacionadas.length) return "Ativo";
  if (relacionadas.every((ec) => ec.status === "Cancelada")) return "Cancelado";
  if (!relacionadas.some((ec) => ec.ativa) && relacionadas.every((ec) => ["Arquivada", "Cancelada"].includes(ec.status))) return "Arquivado";

  const datasEvento = projeto.info.cronograma?.evento?.map((f) => f.data).filter(Boolean) ?? [];
  datasEvento.sort();
  const dataEvento = datasEvento[datasEvento.length - 1] || projeto.info.evento;
  const hojeIso = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  if (dataEvento && dataEvento < hojeIso && relacionadas.some((ec) => ec.status === "Aprovada")) return "Concluido";
  return "Ativo";
}
