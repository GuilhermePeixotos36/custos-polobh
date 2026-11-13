/**
 * O FORMATO em que uma cláusula é guardada (13/11/2026): texto simples, uma
 * linha por parágrafo, com marcas que só o contrato e o editor entendem.
 *
 * Quem edita nunca vê estas marcas — usa os botões do editor (negrito,
 * itálico, sublinhado, listas, recuo, alinhamento), e `domain/clausulaTexto`
 * faz a ponte. Elas existem para que a OS (um campo de texto), o PDF e o editor
 * leiam a MESMA coisa, e para os textos já gravados continuarem valendo.
 *
 * Dentro da linha:
 *   **negrito**   __itálico__   ++sublinhado++
 * No começo da linha (nesta ordem, todos opcionais):
 *   [esq] ou [centro]   alinhamento do parágrafo (sem marca, o texto é justificado)
 *   >>                  um ">" por nível de recuo
 *   - ou 1.             item de lista, com marcador ou numerado
 *
 * Marca desbalanceada (um número ímpar de `**`, `__` ou `++`) é ignorada e
 * removida, para um texto mal editado não sair com a metade do contrato em
 * negrito.
 */

export interface Trecho {
  texto: string;
  forte: boolean;
  italico?: boolean;
  sublinhado?: boolean;
}

const MARCAS = ["**", "__", "++"] as const;
type Marca = (typeof MARCAS)[number];
const CAMPO: Record<Marca, "forte" | "italico" | "sublinhado"> = { "**": "forte", __: "italico", "++": "sublinhado" };
const RE_MARCAS = /(\*\*|__|\+\+)/;

/** Parte o texto nos trechos de mesma formatação. Só marca o que é verdade: `forte` sempre, o resto quando ligado. */
export function partirMarcas(texto: string): Trecho[] {
  let limpo = texto;
  for (const m of MARCAS) {
    const n = limpo.split(m).length - 1;
    if (n % 2 === 1) limpo = limpo.split(m).join("");
  }
  const estado = { forte: false, italico: false, sublinhado: false };
  const saida: Trecho[] = [];
  for (const parte of limpo.split(RE_MARCAS)) {
    if ((MARCAS as readonly string[]).includes(parte)) {
      const campo = CAMPO[parte as Marca];
      estado[campo] = !estado[campo];
      continue;
    }
    if (!parte) continue;
    const t: Trecho = { texto: parte, forte: estado.forte };
    if (estado.italico) t.italico = true;
    if (estado.sublinhado) t.sublinhado = true;
    saida.push(t);
  }
  return saida;
}

export type AlinhamentoClausula = "esq" | "centro";

export interface PrefixoDaLinha {
  alinhar?: AlinhamentoClausula;
  /** Níveis de recuo (0 = sem recuo). */
  nivel: number;
  /** Item de lista: com marcador ("ponto") ou numerado. */
  marcador?: "ponto" | "numero";
  /** O número impresso, quando `marcador` é "numero". */
  numero?: number;
  /** O que sobra da linha, sem as marcas do começo. */
  resto: string;
}

export function lerPrefixo(linha: string): PrefixoDaLinha {
  let resto = linha.trim();
  const saida: PrefixoDaLinha = { nivel: 0, resto };
  const a = /^\[(esq|centro)\]\s*/.exec(resto);
  if (a) {
    saida.alinhar = a[1] as AlinhamentoClausula;
    resto = resto.slice(a[0].length);
  }
  const n = /^(>+)\s*/.exec(resto);
  if (n) {
    saida.nivel = n[1].length;
    resto = resto.slice(n[0].length);
  }
  const ponto = /^[-•–]\s+(.*)$/.exec(resto);
  const numero = /^(\d{1,2})[.)]\s+(.*)$/.exec(resto);
  if (ponto) {
    saida.marcador = "ponto";
    resto = ponto[1];
  } else if (numero) {
    saida.marcador = "numero";
    saida.numero = Number(numero[1]);
    resto = numero[2];
  }
  saida.resto = resto;
  return saida;
}

/** O inverso de `lerPrefixo`: as marcas do começo da linha. */
export function montarPrefixo(p: Omit<PrefixoDaLinha, "resto">): string {
  const alinhar = p.alinhar ? `[${p.alinhar}]` : "";
  const nivel = p.nivel > 0 ? `${">".repeat(p.nivel)} ` : alinhar && p.marcador ? " " : "";
  const marcador = p.marcador === "ponto" ? "- " : p.marcador === "numero" ? `${p.numero ?? 1}. ` : "";
  return `${alinhar}${nivel}${marcador}`;
}
