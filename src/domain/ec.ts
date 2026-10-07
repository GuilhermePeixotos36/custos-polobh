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
import type { Ec, EcLinha } from "@/data/types";

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

/**
 * A DESCRIÇÃO FINANCEIRO acompanha o NOME DO ITEM (07/10/2026).
 *
 * O resumo do financeiro de cada item nasce igual ao nome dele — quem lê a EC
 * pelo financeiro vê "Palco", e não um campo vazio. Enquanto ninguém
 * personalizar o texto, ele segue o nome: se a descrição está vazia ou é
 * exatamente o nome ANTERIOR do item, trocar o nome troca a descrição junto.
 * Escreveu algo próprio ali? A descrição vira da pessoa e o nome do item deixa
 * de mexer nela.
 */
export function aplicarAlteracaoDeLinha(anterior: EcLinha, patch: Partial<EcLinha>): EcLinha {
  const proxima = limitarFormasAoValorDoItem({ ...anterior, ...patch }, patch);
  if (patch.item === undefined || "descricao" in patch) return proxima;
  const acompanha = !anterior.descricao.trim() || anterior.descricao === anterior.item;
  return acompanha ? { ...proxima, descricao: patch.item } : proxima;
}

const CAMPOS_FORMA = ["valorComBvNf", "valorSemBvComNf", "valorSemBvSemNf"] as const;

/**
 * O teto de cada forma de cobrança é o valor definido do item (Valor Pólobh):
 * nenhuma negociação pode custar mais do que o item vale. Sem valor definido
 * (zero) não há teto — o item ainda está sendo descrito. Só os campos que
 * acabaram de ser digitados são cortados, para não reescrever dado antigo.
 */
export function limitarFormasAoValorDoItem(linha: EcLinha, patch: Partial<EcLinha>): EcLinha {
  const teto = Number(linha.valorPolobh) || 0;
  if (teto <= 0) return linha;
  const fora: Partial<EcLinha> = {};
  for (const campo of CAMPOS_FORMA) {
    if (campo in patch && (Number(linha[campo]) || 0) > teto) fora[campo] = teto;
  }
  return Object.keys(fora).length ? { ...linha, ...fora } : linha;
}
