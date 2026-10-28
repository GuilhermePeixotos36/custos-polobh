/**
 * HTML do editor de texto rico → texto puro.
 *
 * A "Descrição Completa" do item da EC é o único campo do sistema guardado como
 * HTML (negrito, bullets). Todo lugar que a leva para fora da tela precisa dela
 * em texto: a planilha em Excel, o descritivo da OS, o documento impresso.
 *
 * A conversão vive aqui, e não em cada um desses lugares, porque a regra é uma
 * só — bullet vira "• ", parágrafo vira linha em branco — e três cópias dela
 * divergiriam na primeira vez que alguém colasse um `<h2>` no editor.
 */

/**
 * Linhas de texto do HTML, já sem espaços em branco nas pontas e sem as linhas
 * vazias do começo e do fim. As do meio ficam: elas são a separação entre
 * parágrafos que a pessoa escreveu.
 */
const RECUO = "    ";

export function htmlParaLinhas(html: string): string[] {
  if (!html) return [];
  // Lista dentro de lista (28/10/2026; a revisão põe os itens de cada local
  // dentro dele): o subtópico ganha recuo e "◦", para a hierarquia não sumir.
  let nivel = 0;
  const comMarcadores = html.replace(/<(\/?)(ul|ol|li)\b[^>]*>/gi, (_, fecha: string, tag: string) => {
    const t = tag.toLowerCase();
    if (t === "li") return fecha ? "\n" : nivel > 1 ? `${RECUO.repeat(nivel - 1)}◦ ` : "• ";
    nivel = Math.max(0, nivel + (fecha ? -1 : 1));
    // Abrir uma sublista no meio de um tópico começa linha nova.
    return !fecha && nivel > 1 ? "\n" : "";
  });
  const txt = comMarcadores
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  // O recuo do subtópico é a única margem que fica; o resto é aparado.
  const linhas = txt.split(/\n/).map((l) => {
    const recuo = l.match(new RegExp(`^\\s*((?:${RECUO})+)◦ `));
    return recuo ? recuo[1] + l.trim() : l.trim();
  }).filter((l, i, todas) => !(l === "" && /^(•|\s*◦)/.test(todas[i + 1] ?? "") && /^(•|\s*◦)/.test(todas[i - 1] ?? "")));
  while (linhas[0] === "") linhas.shift();
  while (linhas.at(-1) === "") linhas.pop();
  return linhas;
}
