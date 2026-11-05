import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/store/toast";
import { somarConsumos, textoConsumo, type ConsumoIa } from "@/domain/consumoIa";
import { apenasMudados, retratoDeTextos, type CampoRevisavel } from "@/domain/revisaoTexto";
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
  /** Tokens e custo desta chamada (05/11/2026). */
  consumo?: ConsumoIa;
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

/**
 * DESCRIÇÃO COMPLETA EM TÓPICOS (28/10/2026). A revisão deixa o texto em
 * bullets: cada linha vira um tópico. A linha sem números seguida de linhas
 * com números ("Saguão Prédio" → "01 profissional x 01 diária…") é tratada
 * como o nome de um local: vira um tópico em negrito, com os itens dentro.
 * Texto que já tem lista fica como está — quem formatou à mão decidiu.
 * É determinístico de propósito: vale mesmo quando a IA falha.
 */
export function emTopicos(html: string): string {
  if (!html.trim() || /<(ul|ol)\b/i.test(html) || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="raiz">${sanitizarHtmlEditor(html)}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  if (!raiz) return html;
  // Cada parágrafo (e cada quebra <br> dentro dele) é uma linha.
  const linhas: string[] = [];
  let atual = "";
  const fechar = () => { if (atual.replace(/&nbsp;|\s/g, "")) linhas.push(atual.trim()); atual = ""; };
  for (const no of [...raiz.childNodes]) {
    if (no instanceof HTMLElement && ["P", "DIV", "BLOCKQUOTE"].includes(no.tagName)) {
      fechar();
      for (const parte of no.innerHTML.split(/<br\s*\/?>/i)) { atual = parte; fechar(); }
    } else if (no instanceof HTMLElement && no.tagName === "BR") {
      fechar();
    } else {
      atual += no instanceof HTMLElement ? no.outerHTML : (no.textContent ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    }
  }
  fechar();
  if (!linhas.length) return html;
  const texto = (l: string) => l.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  const temNumero = (l: string) => /\d/.test(texto(l));
  const negrito = (l: string) => (/^<(b|strong)>[\s\S]*<\/(b|strong)>$/i.test(l) ? l : `<strong>${l}</strong>`);
  let out = "";
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const titulo = !temNumero(l) && texto(l).length <= 60 && i + 1 < linhas.length && temNumero(linhas[i + 1]);
    if (!titulo) { out += `<li>${l}</li>`; continue; }
    const itens: string[] = [];
    while (i + 1 < linhas.length && temNumero(linhas[i + 1])) itens.push(linhas[++i]);
    out += `<li>${negrito(l)}<ul>${itens.map((x) => `<li>${x}</li>`).join("")}</ul></li>`;
  }
  return `<ul>${out}</ul>`;
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
  const consumos: (ConsumoIa | undefined)[] = [];
  let revisaoCompleta = true;
  for (let inicio = 0; inicio < lotes.length; inicio += 3) {
    const respostas = await Promise.all(lotes.slice(inicio, inicio + 3).map(async (lote) => {
      try {
        const { data, error } = await supabase.functions.invoke("corrigir-descricoes-ec", { body: { descricoes: lote } });
        const resposta = data as RespostaCorrecao;
        consumos.push(resposta?.consumo);
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
  // Mostra na hora quanto a revisão gastou (fica registrado em Configurações > Consumo de IA).
  const consumo = somarConsumos(consumos);
  if (consumo && consumo.tokensEntrada + consumo.tokensSaida > 0) toast(`Revisão por IA: ${textoConsumo(consumo)}`, "info");
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


/* -------------------------------------------------------------------------- */
/*                        o revisor de qualquer documento                     */
/* -------------------------------------------------------------------------- */

/**
 * O que já foi revisado nesta sessão do navegador.
 *
 * Duas coisas, ambas comuns, mandariam o mesmo texto duas vezes: salvar, mexer
 * noutro campo e salvar de novo; e a mesma frase repetida em itens diferentes
 * ("Conforme descritivo aprovado pelo cliente."), que numa EC corporativa
 * aparece dezenas de vezes. A chave é o texto ORIGINAL, não o id — por isso a
 * repetição entre itens também é aproveitada.
 *
 * Fica só na memória da aba: some ao recarregar, e é o que se quer. Um cache
 * que sobrevive é um cache que um dia devolve o texto errado.
 */
const jaRevisado = new Map<string, string>();

/** Teto do cache. Uma EC grande tem centenas de textos; sessão longa, milhares. */
const TETO_CACHE = 2000;

function lembrar(original: string, revisado: string): void {
  if (jaRevisado.size >= TETO_CACHE) jaRevisado.clear();
  jaRevisado.set(original, revisado);
}

export interface ResultadoRevisao {
  /** Id do campo -> texto revisado. Só traz o que mudou de fato. */
  textos: Map<string, string>;
  /** Falso quando algum lote não voltou: a correção básica foi aplicada. */
  revisaoCompleta: boolean;
}

/**
 * Revisa uma lista de campos de qualquer documento — EC, OS ou check-list.
 *
 * Esta é a porta pública. As funções específicas acima continuam existindo
 * porque a EC e o projeto já as usavam; o que muda é que passa a haver UM
 * caminho, e não um por tela.
 *
 * O fallback determinístico (maiúsculas) é aplicado SEMPRE, inclusive quando a
 * IA responde — ela pode devolver o texto sem a inicial maiúscula, e a regra da
 * casa vale de qualquer forma. E se a IA estiver fora do ar, o salvamento não
 * para: grava com o fallback e a tela avisa.
 */
export async function revisarCampos(campos: CampoRevisavel[]): Promise<ResultadoRevisao> {
  if (!campos.length) return { textos: new Map(), revisaoCompleta: true };

  const doCache = new Map<string, string>();
  const aPedir: CampoRevisavel[] = [];
  for (const campo of campos) {
    const lembrado = jaRevisado.get(campo.texto);
    if (lembrado !== undefined) doCache.set(campo.id, lembrado);
    else aPedir.push(campo);
  }

  const localDe = (campo: CampoRevisavel) =>
    campo.topicos ? (t: string) => emTopicos(corrigirMaiusculasHtml(t)) : campo.html ? corrigirMaiusculasHtml : corrigirMaiusculas;
  const porId = new Map(campos.map((c) => [c.id, c]));

  const resultado = await corrigirTextos(
    aPedir.map((c) => ({ id: c.id, descricao: c.texto })),
    (texto, id) => localDe(porId.get(id) ?? { id, texto })(texto),
  );

  const textos = new Map(doCache);
  for (const campo of aPedir) {
    const revisado = resultado.textos.get(campo.id);
    if (revisado === undefined) continue;
    lembrar(campo.texto, revisado);
    textos.set(campo.id, revisado);
  }
  return { textos, revisaoCompleta: resultado.revisaoCompleta };
}

/** Só para os testes: o cache é global e vazaria de um caso para o outro. */
export const esquecerRevisoes = (): void => jaRevisado.clear();


/**
 * Revisa um documento inteiro, mandando para a IA SÓ o que mudou.
 *
 * É a porta que as telas usam. Recebe os campos como estão agora e como estavam
 * na última gravação, e devolve o documento já com o texto revisado.
 *
 * A comparação com o estado gravado é o que mantém a conta proporcional às
 * EDIÇÕES DE TEXTO, e não aos SALVAMENTOS: corrigir um valor numa OS de
 * sessenta linhas não remanda sessenta descrições para a IA.
 */
export async function revisarDocumento<T>(
  atual: CampoRevisavel[],
  anterior: CampoRevisavel[],
  aplicar: (revisados: Map<string, string>) => T,
): Promise<{ documento: T; revisaoCompleta: boolean }> {
  const { textos, revisaoCompleta } = await revisarCampos(apenasMudados(atual, retratoDeTextos(anterior)));
  return { documento: aplicar(textos), revisaoCompleta };
}

/** A mensagem que a tela mostra quando o revisor não respondeu. */
export const AVISO_REVISAO_PARCIAL =
  "A correção básica foi aplicada; a revisão por IA está indisponível no momento.";
