/**
 * Ordenação por coluna das listas em matriz — a regra, sem React.
 *
 * Mora separada do componente porque é ela que tem casos difíceis e merece teste: o que decide
 * se "10" vem antes de "9" e se 05/01 vem antes de 28/12 é a comparação, não o cabeçalho.
 *
 * A coluna declara **como** compara, não o que a célula mostra. É a diferença que evita os dois
 * erros clássicos da tabela ordenável: número comparado como texto ("10" < "9") e data comparada
 * pelo dd/mm/aaaa que está na tela (que ordena pelo dia do mês). Por isso o extrator de valor
 * entrega o dado cru — o número como número, a data como ISO — e a formatação continua sendo
 * assunto só de quem desenha a célula.
 */

/**
 * - `texto`: pt-BR de verdade — "Ávila" ao lado de "Avila", caixa não conta.
 * - `natural`: texto com número dentro (UNI-9 antes de UNI-10, tamanho 38 antes de 40). Sem isso
 *   o código do item ordena como string e a peça 10 sobe para perto da 1.
 * - `numero`: subtração; quem entrega o valor entrega o número, nunca o texto formatado.
 * - `data`: ISO (aaaa-mm-dd), que é cronológico quando comparado como string.
 */
export type TipoOrdenacao = "texto" | "natural" | "numero" | "data";
export type SentidoOrdenacao = "asc" | "desc";
export type ValorOrdenavel = string | number | null | undefined;

const COLATOR_TEXTO = new Intl.Collator("pt-BR", { sensitivity: "base" });
const COLATOR_NATURAL = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** O traço é como a tela escreve "não se aplica" — ele é ausência, não um texto que ordena. */
const TEXTOS_VAZIOS = new Set(["", "—", "-"]);

function ehVazio(valor: ValorOrdenavel): boolean {
  if (valor === null || valor === undefined) return true;
  // Zero é saldo, não ausência: só o número que não é número conta como vazio.
  if (typeof valor === "number") return !Number.isFinite(valor);
  return TEXTOS_VAZIOS.has(valor.trim());
}

/** Comparação crescente entre dois valores já sabidos preenchidos. */
export function compararValores(a: ValorOrdenavel, b: ValorOrdenavel, tipo: TipoOrdenacao): number {
  if (tipo === "numero") return Number(a) - Number(b);
  // A data chega em ISO justamente para cair aqui: comparar o texto do ISO É comparar a data.
  if (tipo === "data") return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  if (tipo === "natural") return COLATOR_NATURAL.compare(String(a), String(b));
  return COLATOR_TEXTO.compare(String(a), String(b));
}

/**
 * O sentido do PRIMEIRO clique de cada tipo.
 *
 * Quem clica em "Data" ou "Quantidade" quer ver o topo da lista — o mais recente, o maior —, e
 * quem clica em "Item" ou "Colaborador" quer procurar um nome, o que começa no A.
 */
export function sentidoInicial(tipo: TipoOrdenacao): SentidoOrdenacao {
  return tipo === "numero" || tipo === "data" ? "desc" : "asc";
}

/**
 * Monta o comparador de uma coluna.
 *
 * `desempate` é o que mantém a lista estável quando a coluna empata (metade do estoque tem saldo
 * zero): sem ele, duas colunas diferentes com o mesmo empate desenhariam ordens diferentes para
 * as mesmas linhas e a tela pareceria embaralhar sozinha.
 */
export function comparadorDeColuna<T>(
  valorDe: (item: T) => ValorOrdenavel,
  tipo: TipoOrdenacao,
  sentido: SentidoOrdenacao,
  desempate?: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => {
    const va = valorDe(a);
    const vb = valorDe(b);
    const aVazio = ehVazio(va);
    const bVazio = ehVazio(vb);
    // Célula vazia vai para o fim NOS DOIS SENTIDOS. Invertendo junto, o decrescente abriria a
    // lista com um bloco de traços e esconderia a resposta abaixo dele.
    if (aVazio || bVazio) {
      if (aVazio && bVazio) return desempate?.(a, b) ?? 0;
      return aVazio ? 1 : -1;
    }
    const base = compararValores(va, vb, tipo);
    if (base !== 0) return sentido === "asc" ? base : -base;
    return desempate?.(a, b) ?? 0;
  };
}

/** Ordena uma cópia: a lista de origem é a do cache da consulta e não pode ser reordenada. */
export function ordenarLista<T>(
  itens: readonly T[],
  valorDe: (item: T) => ValorOrdenavel,
  tipo: TipoOrdenacao,
  sentido: SentidoOrdenacao,
  desempate?: (a: T, b: T) => number,
): T[] {
  return [...itens].sort(comparadorDeColuna(valorDe, tipo, sentido, desempate));
}

export type ColunaOrdenavel = {
  rotulo: string;
  /** Sem `chave` a coluna não ordena — é o caso de "Ações" e "Recibo", que não têm dado. */
  chave?: string;
  tipo?: TipoOrdenacao;
};

export type EstadoOrdenacao = { chave: string; sentido: SentidoOrdenacao };

/**
 * Ordena a lista pela coluna escolhida.
 *
 * Coluna sem extrator (ou chave que já não existe, de um estado guardado de antes) devolve a
 * lista como veio em vez de embaralhar: a tela mostra a ordem de origem, que é sempre defensável.
 *
 * A lista aceita buraco (`false`, `null`) porque é a MESMA lista que o cabeçalho desenha, e há
 * tela que monta a coluna condicionalmente — a folha mensal troca de colunas entre validação e
 * consolidado. Duas listas, uma para ordenar e outra para desenhar, é que divergiriam.
 */
export function ordenarPorColuna<T>(
  itens: readonly T[],
  colunas: readonly (ColunaOrdenavel | false | null | undefined)[],
  ordem: EstadoOrdenacao,
  valores: Record<string, (item: T) => ValorOrdenavel>,
  desempate?: (a: T, b: T) => number,
): T[] {
  const coluna = colunas.find((c) => c && c.chave === ordem.chave);
  const valorDe = valores[ordem.chave];
  if (!coluna || !valorDe) return [...itens];
  return ordenarLista(itens, valorDe, coluna.tipo ?? "texto", ordem.sentido, desempate);
}
