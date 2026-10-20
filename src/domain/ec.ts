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
import { chaveDeDivisao } from "@/domain/divisaoEc";
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

/* ------------------------------ dividir item ------------------------------ */

/** A parte que sai do item original para virar um item novo. */
export interface ParteDaDivisao {
  item: string;
  descricao: string;
  valorPolobh: number;
  valorCliente: number;
}

const centavos = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** Por que a divisão não pode ser feita — ou `null` quando pode. */
export function motivoDivisaoInvalida(original: EcLinha, parte: ParteDaDivisao): string | null {
  if (!parte.item.trim()) return "Dê um nome ao novo item.";
  if (parte.valorPolobh < 0 || parte.valorCliente < 0) return "Os valores não podem ser negativos.";
  if (centavos(parte.valorPolobh) > centavos(original.valorPolobh)) {
    return "O valor Pólobh da nova parte passa do valor do item.";
  }
  if (centavos(parte.valorCliente) > centavos(original.valorCliente)) {
    return "O valor Cliente da nova parte passa do valor do item.";
  }
  return null;
}

/**
 * DIVIDIR ITEM (15/10/2026): o mesmo serviço feito por dois fornecedores.
 *
 * Cada item da EC tem UM fornecedor, e a OS sai por fornecedor. Quando o item
 * é atendido por dois, ele vira dois itens no mesmo grupo: o original fica com
 * o que sobra (e com o fornecedor e a OS que já tinha) e a parte nova nasce
 * logo abaixo, sem fornecedor, pronta para receber o outro. A soma dos dois é
 * o valor de antes — a EC não muda de total.
 *
 * A parte nova herda a aprovação: o cliente aprovou o serviço, não o
 * fornecedor. Aprovada, já nasce pedindo a OS dela.
 */
export function dividirLinha(original: EcLinha, parte: ParteDaDivisao, base: EcLinha): [EcLinha, EcLinha] {
  const valorPolobh = Math.max(0, centavos(original.valorPolobh - parte.valorPolobh));
  const valorCliente = Math.max(0, centavos(original.valorCliente - parte.valorCliente));
  // As formas de cobrança do original não podem passar do que sobrou nele.
  const restante = limitarFormasAoValorDoItem(
    { ...original, valorPolobh, valorCliente },
    { valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0 }
  );
  const divisao = chaveDeDivisao(original);
  const nova: EcLinha = {
    ...base,
    divisao,
    grupo: original.grupo,
    item: parte.item.trim(),
    descricao: parte.descricao.trim() || parte.item.trim(),
    valorPolobh: centavos(parte.valorPolobh),
    valorCliente: centavos(parte.valorCliente),
    statusAprovacao: original.statusAprovacao,
    statusOs: original.statusAprovacao === "OK" ? "Emitir" : "Pendente",
    contratoStatus: original.contratoStatus === "Não se Aplica" ? "Não se Aplica" : "Pendente",
    oculto: false,
  };
  return [{ ...restante, divisao }, nova];
}
