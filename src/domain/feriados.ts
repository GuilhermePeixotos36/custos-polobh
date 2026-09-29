/**
 * FERIADOS no quadro do ano — o que a produção precisa enxergar ao marcar data.
 *
 * Pedido de 15/09/2026, com a pergunta certa junto: *"qual seria a nossa fonte
 * para a informação oficial?"*. As duas respostas são diferentes, e é por isso
 * que este módulo existe em vez de uma lista fixa no código:
 *
 *  · NACIONAIS — a BrasilAPI (`/feriados/v1/{ano}`) publica a lista oficial,
 *    inclusive as datas móveis (Carnaval, Corpus Christi), que mudam todo ano e
 *    que ninguém quer manter à mão. É pública e sem chave.
 *  · MUNICIPAIS DE BELO HORIZONTE — **não existe fonte oficial em formato de
 *    dados**. Eles saem de lei municipal, e o que há na internet são listas de
 *    terceiros, que ninguém garante. Então eles são LANÇADOS À MÃO, uma vez por
 *    ano, em Configurações — e é honesto que seja assim: um feriado municipal
 *    errado no quadro é uma montagem marcada num dia em que a cidade para.
 *
 * Os dois vivem juntos aqui, na mesma lista, com a origem marcada — a tela
 * mostra de onde cada um veio, e quem confere sabe o que pode ter envelhecido.
 */

export type OrigemFeriado = "nacional" | "municipal";

export interface Feriado {
  /** Data ISO (aaaa-mm-dd). */
  data: string;
  nome: string;
  origem: OrigemFeriado;
}

/** O que fica guardado em `config_app`, ano a ano. */
export interface FeriadosGuardados {
  /** Feriados municipais lançados à mão, por ano. */
  municipais: Record<string, Feriado[]>;
  /** Cache dos nacionais trazidos da BrasilAPI, por ano. */
  nacionais: Record<string, Feriado[]>;
}

export const feriadosVazios = (): FeriadosGuardados => ({ municipais: {}, nacionais: {} });

/**
 * Os feriados de um ano, nacionais e municipais, sem repetição e em ordem.
 *
 * Quando a mesma data aparece nas duas listas, vence o MUNICIPAL: ele foi
 * lançado por alguém da casa, que sabe como a cidade chama aquele dia.
 */
export function feriadosDoAno(guardados: FeriadosGuardados | undefined, ano: number): Feriado[] {
  const chave = String(ano);
  const municipais = guardados?.municipais?.[chave] ?? [];
  const nacionais = guardados?.nacionais?.[chave] ?? [];
  const porData = new Map<string, Feriado>();
  for (const f of nacionais) porData.set(f.data, f);
  for (const f of municipais) porData.set(f.data, f);
  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Índice data → feriado, para a tela perguntar dia a dia sem varrer a lista. */
export function indiceDeFeriados(lista: Feriado[]): Map<string, Feriado> {
  return new Map(lista.map((f) => [f.data, f]));
}

/**
 * Normaliza o que a BrasilAPI devolve.
 *
 * Ela responde `[{ date, name, type }]`. Só o que tem data no formato esperado
 * entra: uma resposta estranha (um erro em HTML, uma mudança de contrato da API)
 * não pode virar feriado no quadro.
 */
export function feriadosDaApi(dados: unknown): Feriado[] {
  if (!Array.isArray(dados)) return [];
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  return dados
    // `null` e número entram na lista de uma resposta estragada, e `d.date`
    // neles é um erro em tempo de execução, não um item descartado.
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => d as { date?: unknown; name?: unknown })
    .filter((d) => typeof d.date === "string" && RE.test(d.date))
    .map((d) => ({
      data: d.date as string,
      nome: typeof d.name === "string" && d.name.trim() ? d.name.trim() : "Feriado",
      origem: "nacional" as const,
    }));
}
