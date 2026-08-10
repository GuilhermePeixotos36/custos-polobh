import { supabase } from "@/lib/supabaseClient";
import type { EcLinha } from "@/data/types";
import type { RoteiroExtraProjeto, RoteirosProjeto } from "@/data/types";
import { sanitizarHtmlEditor } from "@/lib/sanitizeHtml";

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
  roteirosExtras: RoteiroExtraProjeto[];
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
  return sanitizarHtmlEditor(html).split(/(<[^>]+>)/g).map((parte) => parte.startsWith("<") ? parte : corrigirMaiusculas(parte)).join("");
}

async function corrigirTextos(
  textos: DescricaoCorrigida[],
  fallback: (texto: string, id: string) => string
): Promise<{ textos: Map<string, string>; revisaoCompleta: boolean }> {
  const locais = textos.map((item) => ({ ...item, descricao: fallback(item.descricao, item.id) }));
  if (!locais.length) return { textos: new Map(), revisaoCompleta: true };
  // ECs corporativas têm centenas de textos. Lotes evitam truncar o JSON da IA;
  // três chamadas por rodada equilibram tempo de espera e limite do provedor.
  const lotes: DescricaoCorrigida[][] = [];
  for (const item of locais) {
    const atual = lotes.at(-1);
    const tamanho = atual?.reduce((total, entrada) => total + entrada.descricao.length, 0) ?? 0;
    if (!atual || atual.length >= 30 || tamanho + item.descricao.length > 32_000) lotes.push([item]);
    else atual.push(item);
  }
  const revisados = new Map<string, string>();
  let revisaoCompleta = true;
  for (let inicio = 0; inicio < lotes.length; inicio += 3) {
    const respostas = await Promise.all(lotes.slice(inicio, inicio + 3).map(async (lote) => {
      try {
        const { data, error } = await supabase.functions.invoke("corrigir-descricoes-ec", { body: { descricoes: lote } });
        const resposta = data as RespostaCorrecao;
        return !error && resposta?.ok && Array.isArray(resposta.descricoes) ? resposta.descricoes : null;
      } catch { return null; }
    }));
    respostas.forEach((resposta, indice) => {
      const lote = lotes[inicio + indice];
      if (!resposta) { revisaoCompleta = false; return; }
      const ids = new Set(lote.map((item) => item.id));
      resposta
        .filter((item) => ids.has(item?.id) && typeof item.descricao === "string" && item.descricao.trim())
        .forEach((item) => revisados.set(item.id, fallback(item.descricao, item.id)));
      if (lote.some((item) => !revisados.has(item.id))) revisaoCompleta = false;
    });
  }
  return {
    textos: new Map(locais.map((item) => [item.id, revisados.get(item.id) ?? item.descricao])),
    revisaoCompleta,
  };
}

export async function corrigirRoteirosProjeto(
  roteiros: RoteirosProjeto,
  roteirosExtras: RoteiroExtraProjeto[] = []
): Promise<ResultadoCorrecaoRoteiros> {
  const entradas = Object.entries(roteiros)
    .filter(([, descricao]) => descricao.trim())
    .map(([id, descricao]) => ({ id: `padrao:${id}`, descricao }));
  entradas.push(...roteirosExtras
    .filter((item) => item.conteudo.trim())
    .map((item) => ({ id: `extra:${item.id}`, descricao: item.conteudo })));
  const resultado = await corrigirTextos(entradas, corrigirMaiusculasHtml);
  return {
    roteiros: {
      preEvento: resultado.textos.get("padrao:preEvento") ?? roteiros.preEvento,
      evento: resultado.textos.get("padrao:evento") ?? roteiros.evento,
      posEvento: resultado.textos.get("padrao:posEvento") ?? roteiros.posEvento,
    },
    roteirosExtras: roteirosExtras.map((item) => ({
      ...item,
      conteudo: resultado.textos.get(`extra:${item.id}`) ?? item.conteudo,
    })),
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
