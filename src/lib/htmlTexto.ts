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
export function htmlParaLinhas(html: string): string[] {
  if (!html) return [];
  const txt = html
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  const linhas = txt.split(/\n/).map((l) => l.trim());
  while (linhas[0] === "") linhas.shift();
  while (linhas.at(-1) === "") linhas.pop();
  return linhas;
}
