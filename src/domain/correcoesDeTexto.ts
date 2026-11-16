/**
 * O QUE A REVISÃO CORRIGIU (16/11/2026): a lista "antes → depois" que a tela de
 * Configurações › Contratos mostra antes de gravar, para a pessoa ver cada
 * palavra que a revisão mexeu — e não precisar achar a diferença lendo dois
 * textos inteiros.
 *
 * Compara o texto das duas versões, palavra a palavra, ignorando as marcas de
 * formatação (negrito, itálico, bullets, recuo): só interessa o que mudou nas
 * palavras.
 */
import { lerPrefixo, partirMarcas } from "@/domain/formatoClausula";

export interface Correcao {
  /** O que estava escrito ("" quando a revisão acrescentou algo). */
  de: string;
  /** Como ficou ("" quando a revisão tirou algo). */
  para: string;
}

/** O texto da cláusula só com as palavras: sem prefixos de linha e sem marcas. */
function palavrasDe(texto: string): string[] {
  const corrido = (texto ?? "")
    .split("\n")
    .map((l) => partirMarcas(lerPrefixo(l).resto).map((t) => t.texto).join(""))
    .join(" ");
  return corrido.split(/\s+/).filter(Boolean);
}

/** As diferenças entre o texto escrito e o revisado, agrupando palavras vizinhas que mudaram juntas. */
export function correcoesDaRevisao(original: string, revisado: string): Correcao[] {
  const a = palavrasDe(original);
  const b = palavrasDe(revisado);
  // Maior subsequência comum (as palavras que ficaram iguais).
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const saida: Correcao[] = [];
  let de: string[] = [];
  let para: string[] = [];
  const fechar = () => {
    if (de.length || para.length) saida.push({ de: de.join(" "), para: para.join(" ") });
    de = [];
    para = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      fechar();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || t[i][j + 1] >= t[i + 1][j])) para.push(b[j++]);
    else de.push(a[i++]);
  }
  fechar();
  return saida;
}
