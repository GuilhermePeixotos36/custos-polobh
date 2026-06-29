/**
 * Serviço isolado de geração de descritivo por IA.
 * DESLIGADO por padrão (flags.descritivoIA). NUNCA embutir chave de API no
 * frontend: quando ativar, apontar VITE_AI_ENDPOINT para uma Supabase Edge
 * Function que guarda a chave no servidor.
 * Custo alvo: < R$ 0,03 por descrição.
 */
import { flags } from "./flags";

export interface EscopoLinha {
  item: string;
  descricao: string;
  fornecedor?: string;
  modalidade?: string;
}

const FALLBACK = (e: EscopoLinha) =>
  `${e.item ? e.item + ": " : ""}${e.descricao}`.trim();

export async function gerarDescritivo(escopo: EscopoLinha): Promise<string> {
  if (!flags.descritivoIA) {
    // Sem IA: devolve um descritivo determinístico a partir do escopo.
    return FALLBACK(escopo);
  }
  const endpoint = import.meta.env.VITE_AI_ENDPOINT as string | undefined;
  if (!endpoint) return FALLBACK(escopo);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escopo }),
    });
    if (!resp.ok) return FALLBACK(escopo);
    const data = (await resp.json()) as { descritivo?: string };
    return data.descritivo?.trim() || FALLBACK(escopo);
  } catch {
    return FALLBACK(escopo);
  }
}
