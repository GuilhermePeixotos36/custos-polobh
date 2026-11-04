/**
 * VÁRIOS FORNECEDORES NO MESMO ITEM (04/11/2026).
 *
 * Um item da EC às vezes é pago a vários fornecedores — o "Despesas
 * operacionais" de R$ 600 sai picado para motoboy, cartório, Correios, cada um
 * com o seu CPF ou CNPJ e a sua OS. A tela do item ganhou linhas de
 * fornecedor: cada linha a mais é uma PARTE do item (ver `domain/divisaoEc`),
 * com fornecedor, valor e forma de pagamento próprios, e vira a sua OS.
 *
 * O valor de cada fornecedor SAI do item principal, que fica com o saldo. Assim
 * a soma nunca passa do valor do item na EC (o sistema barra), e para o cliente
 * o item continua sendo um só, com o mesmo total (`juntarDivisoes`).
 */
import type { EcLinha } from "@/data/types";

export type FormaVinculo = "comBvNf" | "semBvComNf" | "semBvSemNf";

export const CAMPO_DA_FORMA: Record<FormaVinculo, "valorComBvNf" | "valorSemBvComNf" | "valorSemBvSemNf"> = {
  comBvNf: "valorComBvNf",
  semBvComNf: "valorSemBvComNf",
  semBvSemNf: "valorSemBvSemNf",
};

export const ROTULO_FORMA: Record<FormaVinculo, string> = {
  comBvNf: "Com BV e NF",
  semBvComNf: "Sem BV e com NF",
  semBvSemNf: "Sem BV e sem NF",
};

const centavos = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** Chave que amarra o item principal aos fornecedores vinculados. */
export const chaveDoPrincipal = (principal: Pick<EcLinha, "id">): string => `div-${principal.id}`;

/** A forma de pagamento de um fornecedor vinculado (a que tem valor; padrão: sem BV e sem NF). */
export function formaDoVinculado(l: EcLinha): FormaVinculo {
  const comValor = (Object.keys(CAMPO_DA_FORMA) as FormaVinculo[]).find((f) => (Number(l[CAMPO_DA_FORMA[f]]) || 0) > 0);
  return comValor ?? "semBvSemNf";
}

/** Os fornecedores vinculados de um item principal (as outras partes, na ordem). */
export function vinculadosDe(principal: EcLinha, linhas: EcLinha[]): EcLinha[] {
  if (!principal.divisao) return [];
  return linhas.filter((l) => l.id !== principal.id && l.divisao === principal.divisao && !l.oculto);
}

/** O valor do item como a EC o mostra: o que ficou no principal + o dos vinculados. */
export function valorTotalDoItem(principal: EcLinha, vinculados: EcLinha[]): number {
  return centavos(vinculados.reduce((s, v) => s + (Number(v.valorPolobh) || 0), Number(principal.valorPolobh) || 0));
}

/**
 * Novo fornecedor no item: uma parte nova, sem fornecedor e com valor zero, que
 * herda nome, descrição e aprovação do principal.
 */
export function novoVinculado(principal: EcLinha, base: EcLinha): { principal: EcLinha; vinculado: EcLinha } {
  const divisao = principal.divisao || chaveDoPrincipal(principal);
  return {
    principal: principal.divisao ? principal : { ...principal, divisao },
    vinculado: {
      ...base,
      divisao,
      grupo: principal.grupo,
      item: principal.item,
      descricao: principal.descricao,
      valorPolobh: 0,
      valorCliente: 0,
      valorComBvNf: 0,
      valorSemBvComNf: 0,
      valorSemBvSemNf: 0,
      statusAprovacao: principal.statusAprovacao,
      statusOs: "Pendente",
      contratoStatus: principal.contratoStatus === "Não se Aplica" ? "Não se Aplica" : "Pendente",
      oculto: false,
    },
  };
}

/**
 * Muda o valor (e a forma) de um fornecedor vinculado. O valor sai do item
 * principal ou volta para ele — e nunca passa do que há disponível: quando
 * passaria, fica no máximo e `excedeu` avisa a tela.
 */
export function definirValorVinculado(
  principal: EcLinha,
  vinculado: EcLinha,
  valor: number,
  forma: FormaVinculo = formaDoVinculado(vinculado)
): { principal: EcLinha; vinculado: EcLinha; excedeu: boolean; disponivel: number } {
  const disponivel = centavos((Number(principal.valorPolobh) || 0) + (Number(vinculado.valorPolobh) || 0));
  const pedido = Math.max(0, centavos(valor));
  const final = Math.min(pedido, disponivel);
  const restoPrincipal = centavos(disponivel - final);
  // As formas do principal não passam do que sobrou nele (zero inclusive).
  const novoPrincipal: EcLinha = { ...principal, valorPolobh: restoPrincipal };
  for (const campo of Object.values(CAMPO_DA_FORMA)) {
    if ((Number(novoPrincipal[campo]) || 0) > restoPrincipal) novoPrincipal[campo] = restoPrincipal;
  }
  const novoVinc: EcLinha = {
    ...vinculado,
    valorPolobh: final,
    valorComBvNf: 0,
    valorSemBvComNf: 0,
    valorSemBvSemNf: 0,
    [CAMPO_DA_FORMA[forma]]: final,
  };
  return { principal: novoPrincipal, vinculado: novoVinc, excedeu: pedido > disponivel, disponivel };
}

/** Tira um fornecedor do item: o valor dele volta para o principal. */
export function desvincular(principal: EcLinha, vinculado: EcLinha): EcLinha {
  return { ...principal, valorPolobh: centavos((Number(principal.valorPolobh) || 0) + (Number(vinculado.valorPolobh) || 0)) };
}

/**
 * Mantém cada fornecedor vinculado LOGO ABAIXO do seu item principal, no mesmo
 * grupo — os vinculados não aparecem como cards próprios, então arrastar ou
 * mover o principal não pode deixá-los para trás.
 *
 * O principal é a linha cuja chave é `div-{id}`; na versão nova da EC (ids
 * novos) a chave deixa de bater, e o primeiro da ordem assume — com a chave
 * refeita para ele, para não trocar de principal num arrasto seguinte.
 */
export function agruparVinculados<G extends { nome: string; itens: EcLinha[] }>(grupos: G[]): G[] {
  const todas = grupos.flatMap((g) => g.itens);
  const porChave = new Map<string, EcLinha[]>();
  for (const l of todas) {
    if (!l.divisao) continue;
    const lista = porChave.get(l.divisao) ?? [];
    lista.push(l);
    porChave.set(l.divisao, lista);
  }
  if (![...porChave.values()].some((m) => m.length > 1)) return grupos;

  /** id do principal → os vinculados dele (já com a chave certa). */
  const filhos = new Map<string, EcLinha[]>();
  const ehFilho = new Set<string>();
  const rechave = new Map<string, string>();
  for (const [chave, membros] of porChave) {
    if (membros.length < 2) continue;
    const principal = membros.find((m) => chaveDoPrincipal(m) === chave) ?? membros[0];
    const nova = chaveDoPrincipal(principal);
    if (nova !== chave) for (const m of membros) rechave.set(m.id, nova);
    filhos.set(principal.id, membros.filter((m) => m.id !== principal.id));
    for (const m of membros) if (m.id !== principal.id) ehFilho.add(m.id);
  }
  const comChave = (l: EcLinha): EcLinha => (rechave.has(l.id) ? { ...l, divisao: rechave.get(l.id) } : l);

  return grupos.map((g) => {
    const itens: EcLinha[] = [];
    for (const l of g.itens) {
      if (ehFilho.has(l.id)) continue;
      itens.push(comChave(l));
      for (const f of filhos.get(l.id) ?? []) itens.push(comChave({ ...f, grupo: g.nome }));
    }
    return { ...g, itens };
  });
}
