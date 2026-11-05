/**
 * CONSUMO DE IA (05/11/2026): cada chamada de IA grava os tokens gastos e o
 * custo estimado na tabela `ia_uso` e no registro de ações (`audit_log`,
 * categoria "IA"). Quem lê é a tela Configurações > Consumo de IA.
 *
 * O custo é ESTIMADO pela tabela abaixo (US$ por milhão de tokens, preços de
 * 05/11/2026). A conta oficial é a do painel da OpenAI. Modelos gratuitos
 * custam zero. Modelo fora da tabela: custo zero e o nome fica no registro,
 * para a tabela ser completada.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import type { RespostaIa, UsoIa } from "./openrouter.ts";

const PRECOS: Record<string, [number, number]> = {
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1-nano": [0.1, 0.4],
  "gpt-4.1": [2, 8],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
  "gpt-5-mini": [0.25, 2],
  "gpt-5-nano": [0.05, 0.4],
  "gemini-2.5-flash-lite": [0.1, 0.4],
  "gemini-2.5-flash": [0.3, 2.5],
};

/** Custo estimado em dólar. Aceita "openai/gpt-4.1-mini" ou "gpt-4.1-mini". */
export function custoEstimado(modelo: string, uso: UsoIa): number {
  if (!modelo || modelo.endsWith(":free")) return 0;
  const nome = modelo.split("/").pop() ?? modelo;
  const preco = PRECOS[nome];
  if (!preco) return 0;
  return (uso.entrada * preco[0] + uso.saida * preco[1]) / 1_000_000;
}

export type FuncaoIa = "revisao" | "leitura_orcamento" | "diagnostico";

const ROTULO: Record<FuncaoIa, string> = {
  revisao: "Revisão de texto",
  leitura_orcamento: "Leitura de orçamento",
  diagnostico: "Diagnóstico",
};

/** O que volta para a tela, para ela mostrar o consumo na hora. */
export interface ConsumoIa {
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  modelo: string;
}

export interface Quem {
  id?: string;
  nome?: string;
  papel?: string;
}

/**
 * Grava o consumo e devolve o resumo para a resposta da função. Nunca derruba
 * a chamada: se a gravação falhar, a IA já respondeu e o texto segue.
 */
export async function registrarUsoIa(
  quem: Quem,
  funcao: FuncaoIa,
  resposta: RespostaIa,
  extra: { itens?: number; duracaoMs?: number } = {},
): Promise<ConsumoIa> {
  const uso = resposta.uso ?? { entrada: 0, saida: 0 };
  const modelo = resposta.ok ? resposta.modelo : "";
  const custo = custoEstimado(modelo, uso);
  const consumo: ConsumoIa = { tokensEntrada: uso.entrada, tokensSaida: uso.saida, custoUsd: custo, modelo };
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tokens = uso.entrada + uso.saida;
    const custoTexto = custo.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const mensagem = resposta.ok
      ? `${ROTULO[funcao]} por IA${extra.itens ? ` (${extra.itens} ${funcao === "leitura_orcamento" ? "arquivo(s)" : "texto(s)"})` : ""}: ${tokens.toLocaleString("pt-BR")} tokens, US$ ${custoTexto} — ${modelo}`
      : `${ROTULO[funcao]} por IA falhou: ${resposta.erro.slice(0, 200)}`;
    await Promise.all([
      sb.from("ia_uso").insert({
        user_id: quem.id ?? null,
        usuario: quem.nome ?? null,
        funcao,
        modelo: modelo || null,
        tokens_entrada: uso.entrada,
        tokens_saida: uso.saida,
        custo_usd: custo,
        sucesso: resposta.ok,
        erro: resposta.ok ? null : resposta.erro.slice(0, 500),
        duracao_ms: extra.duracaoMs ?? null,
        itens: extra.itens ?? null,
      }),
      sb.from("audit_log").insert({
        nivel: resposta.ok ? "info" : "aviso",
        categoria: "IA",
        acao: `ia.${funcao}`,
        mensagem,
        usuario: quem.nome ?? "Sistema",
        papel: quem.papel ?? null,
        user_id: quem.id ?? null,
      }),
    ]);
  } catch (e) {
    console.error(`ia-uso: não gravou o consumo: ${(e as Error).message}`);
  }
  return consumo;
}
