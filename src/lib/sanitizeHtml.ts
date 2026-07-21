const TAGS = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "DIV", "BLOCKQUOTE"]);

function estiloSeguro(valor: string): string {
  return valor
    .split(";")
    .map((regra) => regra.trim())
    .filter((regra) => /^(text-align:\s*(left|center|right|justify)|margin-left:\s*\d+(\.\d+)?(px|em|rem))$/i.test(regra))
    .join("; ");
}

/** Mantém somente a formatação suportada pelo editor e remove scripts/eventos/URLs. */
export function sanitizarHtmlEditor(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html || "";
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  if (!raiz) return "";

  const percorrer = (pai: Node) => {
    [...pai.childNodes].forEach((no) => {
      if (no.nodeType === Node.COMMENT_NODE) { no.remove(); return; }
      if (!(no instanceof HTMLElement)) return;
      percorrer(no);
      if (!TAGS.has(no.tagName)) {
        no.replaceWith(...no.childNodes);
        return;
      }
      const style = estiloSeguro(no.getAttribute("style") ?? "");
      [...no.attributes].forEach((a) => no.removeAttribute(a.name));
      if (style) no.setAttribute("style", style);
    });
  };
  percorrer(raiz);
  return raiz.innerHTML;
}
