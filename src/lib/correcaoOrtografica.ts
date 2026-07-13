import { supabase } from "@/lib/supabaseClient";
import type { EcLinha } from "@/data/types";
import type { RoteirosProjeto } from "@/data/types";

interface DescricaoCorrigida {
  id: string;
  descricao: string;
}

interface RespostaCorrecao {
  ok?: boolean;
  descricoes?: DescricaoCorrigida[];
}

export interface ResultadoCorrecao {
  linhas: EcLinha[];
  revisaoCompleta: boolean;
}

export interface ResultadoCorrecaoRoteiros {
  roteiros: RoteirosProjeto;
  revisaoCompleta: boolean;
}

/**
 * Garante maiúscula no início de parágrafos e frases sem alterar a estrutura,
 * números, siglas ou quebras de linha do texto.
 */
export function corrigirMaiusculas(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(
      /(^|[.!?]\s+)([\s"'([{•\-–—]*)([a-záàâãéêíóôõúüç])/gmu,
      (_, inicio: string, prefixo: string, letra: string) =>
        `${inicio}${prefixo}${letra.toLocaleUpperCase("pt-BR")}`
    );
}

/** Corrige somente nós de texto, preservando as tags geradas pelo editor. */
export function corrigirMaiusculasHtml(html: string): string {
  return html.split(/(<[^>]+>)/g).map((parte) => parte.startsWith("<") ? parte : corrigirMaiusculas(parte)).join("");
}

async function corrigirTextos(
  textos: DescricaoCorrigida[],
  fallback: (texto: string, id: string) => string
): Promise<{ textos: Map<string, string>; revisaoCompleta: boolean }> {
  const locais = textos.map((item) => ({ ...item, descricao: fallback(item.descricao, item.id) }));
  if (!locais.length) return { textos: new Map(), revisaoCompleta: true };
  try {
    const { data, error } = await supabase.functions.invoke("corrigir-descricoes-ec", { body: { descricoes: locais } });
    const resposta = data as RespostaCorrecao;
    if (error || !resposta?.ok || !Array.isArray(resposta.descricoes)) {
      return { textos: new Map(locais.map((item) => [item.id, item.descricao])), revisaoCompleta: false };
    }
    const ids = new Set(locais.map((item) => item.id));
    const revisados = new Map(
      resposta.descricoes
        .filter((item) => ids.has(item?.id) && typeof item.descricao === "string" && item.descricao.trim())
        .map((item) => [item.id, fallback(item.descricao, item.id)] as const)
    );
    return {
      textos: new Map(locais.map((item) => [item.id, revisados.get(item.id) ?? item.descricao])),
      revisaoCompleta: revisados.size === locais.length,
    };
  } catch {
    return { textos: new Map(locais.map((item) => [item.id, item.descricao])), revisaoCompleta: false };
  }
}

export async function corrigirRoteirosProjeto(roteiros: RoteirosProjeto): Promise<ResultadoCorrecaoRoteiros> {
  const entradas = Object.entries(roteiros)
    .filter(([, descricao]) => descricao.trim())
    .map(([id, descricao]) => ({ id, descricao }));
  const resultado = await corrigirTextos(entradas, corrigirMaiusculasHtml);
  return {
    roteiros: {
      preEvento: resultado.textos.get("preEvento") ?? roteiros.preEvento,
      evento: resultado.textos.get("evento") ?? roteiros.evento,
      posEvento: resultado.textos.get("posEvento") ?? roteiros.posEvento,
    },
    revisaoCompleta: resultado.revisaoCompleta,
  };
}

/**
 * Revisa em lote as descrições financeiras da EC. A revisão completa acontece
 * no servidor; se ele estiver indisponível, o salvamento continua com o fallback
 * determinístico de maiúsculas.
 */
export async function corrigirDescricoes(linhas: EcLinha[]): Promise<ResultadoCorrecao> {
  const entradas = linhas.flatMap((linha) => [
    linha.descricao.trim() ? { id: `${linha.id}:financeiro`, descricao: linha.descricao } : null,
    linha.descricaoCompleta.trim() ? { id: `${linha.id}:completa`, descricao: linha.descricaoCompleta } : null,
  ]).filter((item): item is DescricaoCorrigida => item !== null);
  const resultado = await corrigirTextos(
    entradas,
    (texto, id) => id.endsWith(":completa") ? corrigirMaiusculasHtml(texto) : corrigirMaiusculas(texto)
  );
  return {
    linhas: linhas.map((linha) => ({
      ...linha,
      descricao: resultado.textos.get(`${linha.id}:financeiro`) ?? corrigirMaiusculas(linha.descricao),
      descricaoCompleta: resultado.textos.get(`${linha.id}:completa`) ?? corrigirMaiusculasHtml(linha.descricaoCompleta),
    })),
    revisaoCompleta: resultado.revisaoCompleta,
  };
}

export async function corrigirLinhaEc(linha: EcLinha): Promise<{ linha: EcLinha; revisaoCompleta: boolean }> {
  const resultado = await corrigirDescricoes([linha]);
  return { linha: resultado.linhas[0], revisaoCompleta: resultado.revisaoCompleta };
}
