/**
 * Filtro por coluna das listas em matriz — a regra, sem React (o "filtro do Excel", pedido do
 * dono do app em 24/11/2026).
 *
 * Mora separada do cabeçalho pelo mesmo motivo da `ordenacaoTabela`: os casos difíceis são de
 * regra, não de desenho — o que conta como "vazio", o que acontece quando a pessoa desmarca tudo,
 * quais valores o painel oferece quando outra coluna já está filtrada. Isso merece teste.
 *
 * O modelo é o de INCLUSÃO: coluna sem entrada no mapa não filtra; coluna com entrada mostra só
 * as linhas cujo valor está na lista. Marcar de volta todos os valores apaga a entrada — "tudo
 * marcado" e "sem filtro" são a mesma coisa, e guardá-los diferentes acenderia o contador de
 * filtros sem nada estar filtrado. A lista vazia é um filtro de verdade (não passa nada): é o
 * que a pessoa pediu ao desmarcar tudo, e a tela responde com o vazio por filtro e o "Limpar
 * filtros", em vez de devolver em silêncio a lista inteira.
 *
 * Datas e números filtram por VALOR, como o texto, e não por intervalo: nestas listas uma coluna
 * de data tem poucos dias distintos (o dia em que cada EC/OS foi registrada), e a mesma lista de
 * caixas com busca serve às três. Intervalo pediria um segundo tipo de controle no painel para
 * pouco ganho; o extrator de data entrega o DIA em ISO (aaaa-mm-dd) e a tela formata o rótulo.
 */
import { compararValores, type TipoOrdenacao } from "./ordenacaoTabela";

/** O dado cru de uma célula para o filtro — o mesmo tipo que a ordenação lê. */
export type ValorDeFiltro = string | number | null | undefined;

/** Coluna → valores marcados. Coluna ausente = sem filtro. */
export type FiltrosDeColuna = Readonly<Record<string, readonly string[]>>;

/** Extratores por chave de coluna: só a coluna que tem extrator é filtrável. */
export type ExtratoresDeFiltro<T> = Readonly<Record<string, (item: T) => ValorDeFiltro>>;

export const FILTROS_DE_COLUNA_VAZIOS: FiltrosDeColuna = {};

/** A chave do "(vazio)" no painel. O traço é como a tela escreve ausência, então também é vazio. */
export const VALOR_VAZIO = "";
const TEXTOS_VAZIOS = new Set(["", "—", "-"]);

/**
 * O valor como o filtro o guarda: texto aparado, número como texto, ausência como `VALOR_VAZIO`.
 * Texto porque é o que a caixa de marcação carrega e o que a URL/estado guardam sem perda.
 */
export function chaveDoValor(valor: ValorDeFiltro): string {
  if (valor === null || valor === undefined) return VALOR_VAZIO;
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : VALOR_VAZIO;
  const texto = valor.trim();
  return TEXTOS_VAZIOS.has(texto) ? VALOR_VAZIO : texto;
}

/** Quantas colunas estão filtradas — é o número que soma no botão "Filtros". */
export function filtrosDeColunaAtivos(filtros: FiltrosDeColuna): number {
  return Object.keys(filtros).length;
}

export function colunaFiltrada(filtros: FiltrosDeColuna, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(filtros, chave);
}

/** O item passa em todos os filtros (menos o de `ignorar`, quando dado)? */
export function passaNosFiltros<T>(
  item: T,
  filtros: FiltrosDeColuna,
  extratores: ExtratoresDeFiltro<T>,
  ignorar?: string,
): boolean {
  for (const [chave, marcados] of Object.entries(filtros)) {
    if (chave === ignorar) continue;
    const extrair = extratores[chave];
    // Filtro de uma coluna que já não existe nesta tela (estado antigo): não esconde nada.
    if (!extrair) continue;
    if (!marcados.includes(chaveDoValor(extrair(item)))) return false;
  }
  return true;
}

/** Aplica todos os filtros de coluna. Devolve cópia: a lista de origem é a do cache da consulta. */
export function filtrarPorColunas<T>(itens: readonly T[], filtros: FiltrosDeColuna, extratores: ExtratoresDeFiltro<T>): T[] {
  if (filtrosDeColunaAtivos(filtros) === 0) return [...itens];
  return itens.filter((item) => passaNosFiltros(item, filtros, extratores));
}

export type OpcaoDeFiltro = { valor: string; quantidade: number };

/**
 * Os valores que o painel de UMA coluna oferece, com quantas linhas cada um tem.
 *
 * Contados sobre as linhas que passam nos filtros das OUTRAS colunas, como no Excel: filtrou o
 * fornecedor, o painel de Status só oferece os status que aquele fornecedor tem. O filtro da
 * própria coluna fica de fora da conta — senão o painel só mostraria o que já está marcado e não
 * daria para marcar mais nada.
 *
 * Um valor marcado que sumiu (outra coluna o escondeu) continua na lista, com zero: desmarcá-lo
 * tem de ser possível, e uma marcação invisível seria um filtro que ninguém acha para desligar.
 *
 * Ordem: a do tipo da coluna, crescente — data do mais recente para o mais antigo, que é a
 * pergunta de quem filtra por data; o "(vazio)" sempre no fim.
 */
export function opcoesDaColuna<T>(
  itens: readonly T[],
  chave: string,
  filtros: FiltrosDeColuna,
  extratores: ExtratoresDeFiltro<T>,
  tipo: TipoOrdenacao = "texto",
): OpcaoDeFiltro[] {
  const extrair = extratores[chave];
  if (!extrair) return [];
  const contagem = new Map<string, number>();
  for (const item of itens) {
    if (!passaNosFiltros(item, filtros, extratores, chave)) continue;
    const valor = chaveDoValor(extrair(item));
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }
  for (const marcado of filtros[chave] ?? []) if (!contagem.has(marcado)) contagem.set(marcado, 0);
  const sentido = tipo === "data" ? -1 : 1;
  return [...contagem]
    .map(([valor, quantidade]) => ({ valor, quantidade }))
    .sort((a, b) => {
      if (a.valor === VALOR_VAZIO || b.valor === VALOR_VAZIO) return a.valor === VALOR_VAZIO ? 1 : -1;
      const va = tipo === "numero" ? Number(a.valor) : a.valor;
      const vb = tipo === "numero" ? Number(b.valor) : b.valor;
      return sentido * compararValores(va, vb, tipo);
    });
}

/** Valores marcados de uma coluna: sem filtro, todos estão marcados. */
export function marcadosDaColuna(filtros: FiltrosDeColuna, chave: string, todos: readonly string[]): string[] {
  return colunaFiltrada(filtros, chave) ? [...filtros[chave]] : [...todos];
}

/** Grava a marcação de uma coluna; marcação igual a "todos" vira "sem filtro". */
export function definirMarcados(
  filtros: FiltrosDeColuna,
  chave: string,
  marcados: Iterable<string>,
  todos: readonly string[],
): FiltrosDeColuna {
  const conjunto = new Set(marcados);
  const tudo = todos.length > 0 && todos.every((v) => conjunto.has(v));
  const { [chave]: _anterior, ...outros } = filtros;
  if (tudo) return outros;
  // Na ordem do painel, para o estado não depender da ordem dos cliques.
  return { ...outros, [chave]: todos.filter((v) => conjunto.has(v)).concat([...conjunto].filter((v) => !todos.includes(v))) };
}

/** Marca ou desmarca UM valor. */
export function alternarValor(filtros: FiltrosDeColuna, chave: string, valor: string, todos: readonly string[]): FiltrosDeColuna {
  const marcados = new Set(marcadosDaColuna(filtros, chave, todos));
  if (marcados.has(valor)) marcados.delete(valor);
  else marcados.add(valor);
  return definirMarcados(filtros, chave, marcados, todos);
}

/**
 * "Selecionar todos" — dos valores VISÍVEIS no painel. Sem busca, os visíveis são todos e a
 * coluna volta a não filtrar; com busca ("Sono"), marca só o que a busca achou, somando ao que
 * já estava marcado, como o Excel faz.
 */
export function marcarVisiveis(filtros: FiltrosDeColuna, chave: string, visiveis: readonly string[], todos: readonly string[]): FiltrosDeColuna {
  const marcados = new Set(marcadosDaColuna(filtros, chave, todos));
  for (const v of visiveis) marcados.add(v);
  return definirMarcados(filtros, chave, marcados, todos);
}

/** "Limpar" — desmarca os valores visíveis, para a pessoa marcar só o que quer. */
export function desmarcarVisiveis(filtros: FiltrosDeColuna, chave: string, visiveis: readonly string[], todos: readonly string[]): FiltrosDeColuna {
  const marcados = new Set(marcadosDaColuna(filtros, chave, todos));
  for (const v of visiveis) marcados.delete(v);
  return definirMarcados(filtros, chave, marcados, todos);
}

/** Tira o filtro de uma coluna. */
export function limparColuna(filtros: FiltrosDeColuna, chave: string): FiltrosDeColuna {
  if (!colunaFiltrada(filtros, chave)) return filtros;
  const { [chave]: _removido, ...outros } = filtros;
  return outros;
}

/** O dia (aaaa-mm-dd, no fuso de quem está na tela) de um carimbo ISO — o valor de filtro das datas. */
export function diaDoCarimbo(iso: string | null | undefined): string {
  if (!iso) return VALOR_VAZIO;
  // Só a data ("2026-11-09") já é o dia; o carimbo completo passa pelo fuso local, senão a EC
  // criada às 22h de Brasília cairia no dia seguinte (UTC).
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return VALOR_VAZIO;
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
