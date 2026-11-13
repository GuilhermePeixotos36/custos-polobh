/**
 * O texto de uma cláusula, entre o editor e o contrato (13/11/2026).
 *
 * O contrato guarda cada cláusula como TEXTO SIMPLES — uma linha por parágrafo,
 * com as marcas descritas em `domain/formatoClausula` (`**negrito**`,
 * `__itálico__`, `++sublinhado++`, e no começo da linha o alinhamento, o recuo
 * e o item de lista). Quem edita, em Configurações › Contratos, não vê marca
 * nenhuma: usa os botões de um editor de texto. Estas duas funções fazem a
 * ponte, e uma desfaz a outra — o que sai do editor é sempre o que o contrato e
 * o PDF leem, e o texto que já estava gravado abre no editor como estava.
 */
import {
  lerPrefixo,
  montarPrefixo,
  partirMarcas,
  type AlinhamentoClausula,
  type PrefixoDaLinha,
} from "@/domain/formatoClausula";

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Quanto, em pixels, o editor recua por nível. */
const PX_POR_NIVEL = 40;

/* ------------------------------ texto → editor ------------------------------ */

/** O conteúdo de uma linha (sem as marcas do começo) → HTML, com os trechos em <strong>, <em> e <u>. */
function inlineParaHtml(texto: string): string {
  return partirMarcas(texto)
    .map((t) => {
      let h = escapar(t.texto);
      if (t.sublinhado) h = `<u>${h}</u>`;
      if (t.italico) h = `<em>${h}</em>`;
      if (t.forte) h = `<strong>${h}</strong>`;
      return h;
    })
    .join("");
}

const estiloDe = (p: Pick<PrefixoDaLinha, "alinhar" | "nivel">): string => {
  const regras: string[] = [];
  if (p.nivel > 0) regras.push(`margin-left: ${p.nivel * PX_POR_NIVEL}px`);
  if (p.alinhar) regras.push(`text-align: ${p.alinhar === "centro" ? "center" : "left"}`);
  return regras.length ? ` style="${regras.join("; ")}"` : "";
};

/** O texto da cláusula → o HTML que o editor mostra. */
export function textoParaHtml(texto: string): string {
  const linhas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  /** A lista aberta (itens seguidos do mesmo tipo entram na mesma lista). */
  let lista: "ul" | "ol" | null = null;
  const fechar = () => {
    if (lista) html += `</${lista}>`;
    lista = null;
  };

  for (const bruta of linhas) {
    const pre = lerPrefixo(bruta);
    if (!pre.resto.trim() && !pre.marcador) {
      fechar();
      html += "<p><br></p>";
      continue;
    }
    if (pre.marcador) {
      const tipo = pre.marcador === "numero" ? "ol" : "ul";
      if (lista !== tipo) {
        fechar();
        html += `<${tipo}>`;
        lista = tipo;
      }
      html += `<li${estiloDe(pre)}>${inlineParaHtml(pre.resto)}</li>`;
      continue;
    }
    fechar();
    html += `<p${estiloDe(pre)}>${inlineParaHtml(pre.resto)}</p>`;
  }
  fechar();
  return html;
}

/* ------------------------------ editor → texto ------------------------------ */

interface Contexto {
  nivel: number;
  alinhar?: AlinhamentoClausula;
  /** A lista em que estamos, com a contagem dos itens (o número impresso). */
  lista?: { tipo: "ul" | "ol"; n: number };
}

const INLINE = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "A", "FONT", "S", "STRIKE", "SUB", "SUP", "MARK", "CODE"]);
const NEGRITOS = new Set(["B", "STRONG"]);
const ITALICOS = new Set(["I", "EM"]);

const ehBloco = (no: Node): no is HTMLElement => no instanceof HTMLElement && !INLINE.has(no.tagName) && no.tagName !== "BR";

/** margin-left do editor → níveis de recuo. */
function nivelDoEstilo(el: HTMLElement): number {
  const m = /margin-left:\s*(\d+(?:\.\d+)?)(px|em|rem)/i.exec(el.getAttribute("style") ?? "");
  if (!m) return 0;
  const px = m[2].toLowerCase() === "px" ? Number(m[1]) : Number(m[1]) * 16;
  return Math.min(4, Math.round(px / PX_POR_NIVEL));
}

function alinhamentoDo(el: HTMLElement): AlinhamentoClausula | undefined {
  const m = /text-align:\s*(left|center|right|justify)/i.exec(el.getAttribute("style") ?? "") ?? /^(left|center|right|justify)$/i.exec(el.getAttribute("align") ?? "");
  const v = m?.[1]?.toLowerCase();
  return v === "center" ? "centro" : v === "left" ? "esq" : undefined;
}

/** Os nós de uma linha → texto com as marcas `**`, `__` e `++`. */
function inlineParaTexto(nos: Node[], f: { forte: boolean; italico: boolean; sublinhado: boolean }): string {
  let saida = "";
  for (const no of nos) {
    if (no.nodeType === Node.TEXT_NODE) {
      const t = (no.textContent ?? "").replace(/ /g, " ").replace(/[\r\n]+/g, " ");
      if (!t) continue;
      if (!t.trim() || !(f.forte || f.italico || f.sublinhado)) {
        saida += t;
        continue;
      }
      // Os espaços das pontas ficam fora das marcas.
      const [, antes, meio, depois] = /^(\s*)([\s\S]*?)(\s*)$/.exec(t)!;
      let c = meio;
      if (f.sublinhado) c = `++${c}++`;
      if (f.italico) c = `__${c}__`;
      if (f.forte) c = `**${c}**`;
      saida += antes + c + depois;
      continue;
    }
    if (!(no instanceof HTMLElement)) continue;
    saida += inlineParaTexto([...no.childNodes], {
      forte: f.forte || NEGRITOS.has(no.tagName) || /font-weight:\s*(bold|[6-9]00)/i.test(no.getAttribute("style") ?? ""),
      italico: f.italico || ITALICOS.has(no.tagName) || /font-style:\s*italic/i.test(no.getAttribute("style") ?? ""),
      sublinhado: f.sublinhado || no.tagName === "U" || /text-decoration[^;]*underline/i.test(no.getAttribute("style") ?? ""),
    });
  }
  // Dois trechos seguidos com a mesma marca (`**a****b**`) são um trecho só.
  return saida.replace(/\*\*\*\*/g, "").replace(/____/g, "").replace(/\+\+\+\+/g, "");
}

/** O HTML do editor → o texto da cláusula. */
export function htmlParaTexto(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  if (!raiz) return "";

  const linhas: string[] = [];

  /** Emite as linhas de um trecho de texto corrido (o <br> quebra a linha). */
  const emitir = (nos: Node[], ctx: Contexto, comMarcador: PrefixoDaLinha["marcador"] | undefined, numero: number | undefined) => {
    const segmentos: Node[][] = [[]];
    for (const no of nos) {
      if (no instanceof HTMLElement && no.tagName === "BR") segmentos.push([]);
      else segmentos[segmentos.length - 1].push(no);
    }
    // O <br> do fim de um parágrafo é só o marcador de linha vazia do navegador.
    const textos = segmentos.map((s) => inlineParaTexto(s, { forte: false, italico: false, sublinhado: false }));
    if (textos.length > 1 && !textos[textos.length - 1].trim()) textos.pop();
    textos.forEach((t, i) => {
      if (!t.trim()) {
        linhas.push("");
        return;
      }
      const prefixo = montarPrefixo({
        alinhar: ctx.alinhar,
        nivel: ctx.nivel,
        marcador: i === 0 ? comMarcador : undefined,
        numero,
      });
      linhas.push(`${prefixo}${t.trim()}`);
    });
  };

  const temConteudo = (nos: Node[]) =>
    nos.some((n) => (n.textContent ?? "").trim() || (n instanceof HTMLElement && n.tagName === "BR"));

  /** Um elemento de bloco: parágrafo, lista, item, recuo… */
  const bloco = (no: HTMLElement, ctx: Contexto) => {
    const tag = no.tagName;
    const filhoCtx: Contexto = {
      nivel: ctx.nivel + (tag === "BLOCKQUOTE" ? 1 : 0) + nivelDoEstilo(no),
      alinhar: alinhamentoDo(no) ?? ctx.alinhar,
      lista: ctx.lista,
    };
    if (tag === "UL" || tag === "OL") {
      // Lista dentro de lista (o recuo do navegador) é um nível a mais.
      percorrer(no, { ...filhoCtx, nivel: filhoCtx.nivel + (ctx.lista ? 1 : 0), lista: { tipo: tag === "UL" ? "ul" : "ol", n: 0 } });
      return;
    }
    if (tag === "LI" && ctx.lista) {
      ctx.lista.n += 1;
      const marcador = ctx.lista.tipo === "ol" ? "numero" : "ponto";
      // O texto do item vem antes de qualquer lista aninhada dentro dele.
      const proprios: Node[] = [];
      const aninhadas: HTMLElement[] = [];
      for (const f of [...no.childNodes]) {
        if (ehBloco(f) && (f.tagName === "UL" || f.tagName === "OL")) aninhadas.push(f);
        else proprios.push(f);
      }
      // Item vazio (o Enter que o navegador deixa para trás) não vira linha.
      if (temConteudo(proprios)) emitir(proprios, filhoCtx, marcador, ctx.lista.n);
      for (const a of aninhadas) bloco(a, filhoCtx);
      return;
    }
    // Parágrafo, <div>, título…: só texto corrido é uma linha; se tem blocos
    // dentro (um <div> que embrulha parágrafos), é um contêiner.
    const filhos = [...no.childNodes];
    if (filhos.some(ehBloco)) percorrer(no, { ...filhoCtx, lista: undefined });
    else emitir(filhos, filhoCtx, undefined, undefined);
  };

  const percorrer = (pai: HTMLElement, ctx: Contexto) => {
    let buffer: Node[] = [];
    const soltar = () => {
      if (temConteudo(buffer)) emitir(buffer, ctx, undefined, undefined);
      buffer = [];
    };
    for (const no of [...pai.childNodes]) {
      if (!ehBloco(no)) {
        buffer.push(no);
        continue;
      }
      soltar();
      bloco(no, ctx);
    }
    soltar();
  };

  percorrer(raiz, { nivel: 0 });
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  return linhas.join("\n");
}
