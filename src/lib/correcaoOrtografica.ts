import { supabase } from "@/lib/supabaseClient";
import type { EcLinha } from "@/data/types";

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

/**
 * Revisa em lote as descrições financeiras da EC. A revisão completa acontece
 * no servidor; se ele estiver indisponível, o salvamento continua com o fallback
 * determinístico de maiúsculas.
 */
export async function corrigirDescricoes(linhas: EcLinha[]): Promise<ResultadoCorrecao> {
  const locais = linhas.map((linha) => ({
    ...linha,
    descricao: corrigirMaiusculas(linha.descricao),
  }));
  const descricoes = locais
    .filter((linha) => linha.descricao.trim())
    .map(({ id, descricao }) => ({ id, descricao }));

  if (!descricoes.length) return { linhas: locais, revisaoCompleta: true };

  try {
    const { data, error } = await supabase.functions.invoke("corrigir-descricoes-ec", {
      body: { descricoes },
    });
    if (error) return { linhas: locais, revisaoCompleta: false };

    const resposta = data as RespostaCorrecao;
    if (!resposta?.ok || !Array.isArray(resposta.descricoes)) {
      return { linhas: locais, revisaoCompleta: false };
    }

    const originais = new Map(descricoes.map((item) => [item.id, item.descricao] as const));
    const porId = new Map(
      resposta.descricoes
        .filter((item) => {
          const original = originais.get(item?.id);
          return original != null &&
            typeof item.descricao === "string" &&
            item.descricao.trim() !== "" &&
            item.descricao.split("\n").length === original.split("\n").length;
        })
        .map((item) => [item.id, corrigirMaiusculas(item.descricao)] as const)
    );
    return {
      linhas: locais.map((linha) => ({
        ...linha,
        descricao: porId.get(linha.id) ?? linha.descricao,
      })),
      revisaoCompleta: porId.size === descricoes.length,
    };
  } catch {
    return { linhas: locais, revisaoCompleta: false };
  }
}
