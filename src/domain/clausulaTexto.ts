/**
 * O texto de uma cláusula, entre o editor e o contrato (13/11/2026).
 *
 * O contrato guarda cada cláusula como TEXTO SIMPLES: uma linha por parágrafo e
 * `**assim**` para o negrito (é o que `partirEmDestaques` e `blocosDaClausula`
 * entendem, e o que as OS já gravam). Quem edita, em Configurações › Contratos,
 * não vê asteriscos: usa o botão de negrito num editor de texto. Estas duas
 * funções fazem a ponte, e uma desfaz a outra — o texto que sai do editor é
 * sempre o que o contrato lê.
 *
 * Só existem parágrafo e negrito, porque é só isso que o PDF desenha: itálico,
 * sublinhado e listas do editor, se vierem de um texto colado, viram texto
 * comum (cada item de lista, uma linha).
 */

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "A **b** c" → "A <strong>b</strong> c" (o texto já escapado). */
const negritoParaTag = (linha: string) => escapar(linha).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** O texto da cláusula → o HTML que o editor mostra: um parágrafo por linha, linha vazia vira respiro. */
export function textoParaHtml(texto: string): string {
  return (texto ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linha) => (linha.trim() ? `<p>${negritoParaTag(linha)}</p>` : "<p><br></p>"))
    .join("");
}

const BLOCOS = new Set(["P", "DIV", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6"]);
const NEGRITOS = new Set(["B", "STRONG"]);

/** O HTML do editor → o texto da cláusula (uma linha por parágrafo, `**` no negrito). */
export function htmlParaTexto(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  if (!raiz) return "";

  const linhas: string[] = [];
  let atual = "";
  const fechar = () => {
    linhas.push(atual);
    atual = "";
  };

  const percorrer = (no: Node, negrito: boolean) => {
    if (no.nodeType === Node.TEXT_NODE) {
      const t = (no.textContent ?? "").replace(/ /g, " ");
      if (!t) return;
      // Texto em negrito vira **…**; os espaços das pontas ficam fora dos asteriscos.
      if (negrito && t.trim()) {
        const [, antes, meio, depois] = /^(\s*)([\s\S]*?)(\s*)$/.exec(t)!;
        atual += `${antes}**${meio}**${depois}`;
      } else atual += t;
      return;
    }
    if (!(no instanceof HTMLElement)) return;
    if (no.tagName === "BR") {
      fechar();
      return;
    }
    const bloco = BLOCOS.has(no.tagName) || no.tagName === "UL" || no.tagName === "OL";
    const ehNegrito = negrito || NEGRITOS.has(no.tagName);
    if (bloco && atual) fechar();
    const antes = linhas.length;
    no.childNodes.forEach((f) => percorrer(f, ehNegrito));
    if (BLOCOS.has(no.tagName)) {
      // Parágrafo vazio (só um <br>) já fechou a própria linha; senão fecha aqui.
      if (atual || linhas.length === antes) fechar();
    }
  };
  raiz.childNodes.forEach((f) => percorrer(f, false));
  if (atual) fechar();

  // `**a****b**` (dois trechos em negrito colados) é um trecho só.
  return linhas
    .join("\n")
    .replace(/\*\*\*\*/g, "")
    .replace(/\n+$/g, "");
}
