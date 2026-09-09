/**
 * Situação da EC: ou ela está **Ativa**, ou está **Arquivada**. Não há terceira.
 *
 * Cada projeto tem UMA estimativa no ar — a que vale — e todas as outras são o
 * arquivo do projeto: as versões anteriores, as tentativas descartadas, o que
 * veio de outro evento. O arquivo não é um cemitério: é de lá que se importa
 * (ver `Importar EC`), e de lá que se traz uma versão de volta ao ar.
 *
 * Quem manda é a bandeira `ativa` — uma só por projeto, garantida por índice
 * único no banco. A coluna `ecs.status` continua existindo e é mantida em dia
 * ('Ativa' / 'Arquivada', migração `20260909100000`), mas ela ACOMPANHA a
 * bandeira; não é mais uma segunda fonte de verdade.
 *
 * Por que isso mudou (09/09/2026): o `status` era herdeiro de um fluxo de
 * aprovação do cliente que não existe mais, e carregava seis valores
 * ('Rascunho', 'Aguardando', 'Aprovada', 'Reprovada', 'Cancelada',
 * 'Arquivada'). Ler o PAR (status, ativa) fazia a mesma EC aparecer ora como
 * "Rascunho", ora como "Arquivada", conforme o caminho pelo qual ela tinha
 * saído do ar — e ninguém conseguia dizer o que cada selo queria dizer. Com
 * dois estados a pergunta que a tela responde é a única que importa no dia a
 * dia: esta é a estimativa que vale, ou não é?
 *
 * A regra de edição sai daí, direta: **edita-se a que está no ar**. Para mexer
 * numa arquivada, traga-a de volta ("Tornar EC ativa") ou copie-a para uma
 * versão nova ("Importar EC" / "Gerar nova versão") — nos dois casos o que
 * estava no ar vai para o arquivo, e nada se perde.
 */
import type { Ec } from "@/data/types";

export type SituacaoEc = "ativa" | "arquivada";

/** No ar ou no arquivo — ver o cabeçalho do módulo. */
export function situacaoEc(ec: Pick<Ec, "ativa">): SituacaoEc {
  return ec.ativa ? "ativa" : "arquivada";
}

export const ROTULO_SITUACAO_EC: Record<SituacaoEc, string> = {
  ativa: "Ativa",
  arquivada: "Arquivada",
};

/** Cor do selo — o mesmo par rótulo/cor em toda tela que mostra uma EC. */
export const TOM_SITUACAO_EC: Record<SituacaoEc, "success" | "neutral"> = {
  ativa: "success",
  arquivada: "neutral",
};

/** Pode abrir o editor? Só a que está no ar. */
export function ecEditavel(ec: Pick<Ec, "ativa">): boolean {
  return situacaoEc(ec) === "ativa";
}

/** Por que não pode editar — texto para a tela de bloqueio. `null` quando pode. */
export function motivoBloqueioEc(ec: Pick<Ec, "ativa">): string | null {
  return ecEditavel(ec)
    ? null
    : "está arquivada — no projeto vale outra estimativa, ou nenhuma";
}
