/**
 * CONSUMO DE IA (05/11/2026) — contas puras do relatório e do aviso na hora.
 *
 * Cada chamada de IA do app grava tokens e custo estimado na tabela `ia_uso`
 * (ver `supabase/functions/_shared/ia-uso.ts`). Aqui só se soma e se formata.
 */

/** O que a função de IA devolve junto com o resultado. */
export interface ConsumoIa {
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  modelo: string;
}

export type FuncaoIa = "revisao" | "leitura_orcamento" | "diagnostico";

export const ROTULO_FUNCAO_IA: Record<FuncaoIa, string> = {
  revisao: "Revisão de texto",
  leitura_orcamento: "Leitura de orçamento",
  diagnostico: "Diagnóstico",
};

/** Uma linha da tabela `ia_uso`. */
export interface RegistroIa {
  id: string;
  criadoEm: string;
  usuario: string;
  funcao: FuncaoIa;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  sucesso: boolean;
  erro: string;
  itens: number;
  duracaoMs: number;
}

export interface Totais {
  chamadas: number;
  falhas: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
}

const zerado = (): Totais => ({ chamadas: 0, falhas: 0, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0 });

function somar(t: Totais, r: RegistroIa): Totais {
  return {
    chamadas: t.chamadas + 1,
    falhas: t.falhas + (r.sucesso ? 0 : 1),
    tokensEntrada: t.tokensEntrada + r.tokensEntrada,
    tokensSaida: t.tokensSaida + r.tokensSaida,
    custoUsd: t.custoUsd + r.custoUsd,
  };
}

/** Totais gerais, por tipo de uso e por pessoa (pessoas em ordem de custo). */
export function resumirConsumo(registros: RegistroIa[]): {
  total: Totais;
  porFuncao: { funcao: FuncaoIa; totais: Totais }[];
  porPessoa: { usuario: string; totais: Totais }[];
} {
  let total = zerado();
  const funcoes = new Map<FuncaoIa, Totais>();
  const pessoas = new Map<string, Totais>();
  for (const r of registros) {
    total = somar(total, r);
    funcoes.set(r.funcao, somar(funcoes.get(r.funcao) ?? zerado(), r));
    const quem = r.usuario || "Sem identificação";
    pessoas.set(quem, somar(pessoas.get(quem) ?? zerado(), r));
  }
  return {
    total,
    porFuncao: [...funcoes].map(([funcao, totais]) => ({ funcao, totais })).sort((a, b) => b.totais.custoUsd - a.totais.custoUsd),
    porPessoa: [...pessoas].map(([usuario, totais]) => ({ usuario, totais })).sort((a, b) => b.totais.custoUsd - a.totais.custoUsd || b.totais.chamadas - a.totais.chamadas),
  };
}

/** Soma o consumo de várias chamadas (a revisão manda os textos em lotes). */
export function somarConsumos(lista: (ConsumoIa | null | undefined)[]): ConsumoIa | null {
  const validos = lista.filter((c): c is ConsumoIa => !!c);
  if (!validos.length) return null;
  return {
    tokensEntrada: validos.reduce((s, c) => s + (Number(c.tokensEntrada) || 0), 0),
    tokensSaida: validos.reduce((s, c) => s + (Number(c.tokensSaida) || 0), 0),
    custoUsd: validos.reduce((s, c) => s + (Number(c.custoUsd) || 0), 0),
    modelo: validos.map((c) => c.modelo).find(Boolean) ?? "",
  };
}

export const formatarTokens = (n: number): string => Math.round(n).toLocaleString("pt-BR");

/** Dólar com 4 casas abaixo de 1 centavo (o custo de uma chamada é fração de centavo). */
export function formatarUsd(v: number): string {
  const casas = Math.abs(v) > 0 && Math.abs(v) < 0.01 ? 4 : 2;
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
}

/** "1.234 tokens · US$ 0,0006" — o texto do aviso depois de cada uso. */
export function textoConsumo(c: ConsumoIa): string {
  return `${formatarTokens(c.tokensEntrada + c.tokensSaida)} tokens · ${formatarUsd(c.custoUsd)}`;
}
