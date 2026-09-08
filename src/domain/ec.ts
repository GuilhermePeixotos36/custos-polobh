/**
 * Situação da EC e o que ela permite.
 *
 * A EC tem dois campos que juntos dizem em que pé ela está: `status` (legado do
 * antigo fluxo de aprovação do cliente, hoje usado para "Rascunho", "Arquivada"
 * e "Cancelada") e `ativa` (só uma por projeto — é a versão que vale).
 *
 * Ler os dois separados dava respostas erradas: uma EC recém-IMPORTADA nasce em
 * Rascunho e NÃO ativa (para não derrubar a EC ativa do projeto), e a tela lia
 * "não ativa" como "arquivada" — o rascunho aparecia com selo de arquivada na
 * lista e caía direto em "Edição bloqueada", sem nunca ter sido editado. Daí
 * este módulo: uma leitura só, usada por todas as telas.
 *
 * O CONTRATO COM O BANCO (migração `20260908120000`): quem SAI do ar sai
 * ARQUIVADA. `definir_ec_ativa` e `salvar_ec_completa` apenas baixavam a
 * bandeira `ativa` da versão anterior, e ela ficava com status 'Rascunho' —
 * então a lista mostrava "Rascunho" numa EC que já tinha sido substituída, e
 * não havia como distingui-la de uma cópia recém-importada. Com o banco
 * arquivando na substituição, `Rascunho + não ativa` volta a significar uma
 * coisa só: nunca entrou no ar. É o estado da importação e da cópia.
 *
 * A regra de edição é sobre o que já foi FINALIZADO:
 *   · Cancelada / Arquivada  → nunca mais se edita (o histórico é preservado;
 *     para mudar algo, gera-se uma nova versão);
 *   · Rascunho               → sempre editável, seja ela a ativa ou não. Um
 *     rascunho nunca foi fechado com ninguém — é exatamente o estado em que
 *     nascem a importação e a duplicação;
 *   · demais status          → só enquanto for a versão ativa do projeto.
 */
import type { Ec } from "@/data/types";

export type SituacaoEc = "ativa" | "rascunho" | "arquivada" | "cancelada";

/** O par (status, ativa) reduzido ao que a tela precisa mostrar e decidir. */
export function situacaoEc(ec: Pick<Ec, "status" | "ativa">): SituacaoEc {
  if (ec.status === "Cancelada") return "cancelada";
  if (ec.status === "Arquivada") return "arquivada";
  if (ec.ativa) return "ativa";
  // Não é a ativa e não foi arquivada: só continua "viva" se for rascunho.
  return ec.status === "Rascunho" ? "rascunho" : "arquivada";
}

export const ROTULO_SITUACAO_EC: Record<SituacaoEc, string> = {
  ativa: "Ativa",
  rascunho: "Rascunho",
  arquivada: "Arquivada",
  cancelada: "Cancelada",
};

/** Cor do selo — o mesmo par rótulo/cor em toda tela que mostra uma EC. */
export const TOM_SITUACAO_EC: Record<SituacaoEc, "success" | "info" | "neutral" | "danger"> = {
  ativa: "success",
  rascunho: "info",
  arquivada: "neutral",
  cancelada: "danger",
};

/** Pode abrir o editor? Ver a regra no cabeçalho do módulo. */
export function ecEditavel(ec: Pick<Ec, "status" | "ativa">): boolean {
  const situacao = situacaoEc(ec);
  return situacao === "ativa" || situacao === "rascunho";
}

/** Por que não pode editar — texto para a tela de bloqueio. `null` quando pode. */
export function motivoBloqueioEc(ec: Pick<Ec, "status" | "ativa">): string | null {
  switch (situacaoEc(ec)) {
    case "cancelada":
      return "está cancelada";
    case "arquivada":
      return "está arquivada (foi substituída por uma versão mais nova)";
    default:
      return null;
  }
}
