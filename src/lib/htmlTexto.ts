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

/** Marcadores internos de negrito (caracteres que ninguém digita). */
const NEG_ABRE = "\u0001";
const NEG_FECHA = "\u0002";
const SEM_MARCAS = /[\u0001\u0002]/g;

/**
 * As linhas do HTML com o negrito marcado por `NEG_ABRE`/`NEG_FECHA` — a base
 * das duas saídas abaixo (texto puro e texto rico do Excel).
 */
function linhasComMarcas(html: string): string[] {
  if (!html) return [];
  // Lista dentro de lista (28/10/2026; a revisão põe os itens de cada local
  // dentro dele): o subtópico ganha recuo e "◦", para a hierarquia não sumir.
  let nivel = 0;
  // Num HTML, a quebra de linha crua é só espaço — quem quebra é a tag. Ela
  // aparecia no meio da frase ("- \n\nPicadinho da Nonna") e partia o tópico
  // em três linhas no Excel (06/11/2026). Texto sem tag nenhuma (gravado antes
  // do editor rico) continua com as suas quebras.
  const temTags = /<[a-z/][^>]*>/i.test(html);
  const fonte = temTags ? html.replace(/\s*[\r\n]+\s*/g, " ") : html;
  const comMarcadores = fonte.replace(/<(\/?)(ul|ol|li)\b[^>]*>/gi, (_, fecha: string, tag: string) => {
    const t = tag.toLowerCase();
    if (t === "li") return fecha ? "\n" : nivel > 1 ? `${RECUO.repeat(nivel - 1)}◦ ` : "• ";
    nivel = Math.max(0, nivel + (fecha ? -1 : 1));
    // Abrir uma sublista no meio de um tópico começa linha nova.
    return !fecha && nivel > 1 ? "\n" : "";
  });
  const txt = comMarcadores
    .replace(/<(strong|b)\b[^>]*>/gi, NEG_ABRE)
    .replace(/<\/(strong|b)>/gi, NEG_FECHA)
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  const vazia = (l: string) => l.replace(SEM_MARCAS, "").trim() === "";
  const topico = (l: string | undefined) => /^(•|\s*◦)/.test((l ?? "").replace(SEM_MARCAS, ""));
  // O recuo do subtópico é a única margem que fica; o resto é aparado.
  const linhas = txt.split(/\n/).map((l) => {
    const recuo = l.replace(SEM_MARCAS, "").match(new RegExp(`^\\s*((?:${RECUO})+)◦ `));
    // Apara os espaços das pontas sem perder um marcador de negrito que esteja nelas.
    const aparada = l
      .replace(/^[\s\u0001\u0002]+/, (m) => m.replace(/\s/g, ""))
      .replace(/[\s\u0001\u0002]+$/, (m) => m.replace(/\s/g, ""));
    // Espaços repetidos (o "&nbsp;&nbsp;" de quem alinhou na mão) viram um só.
    let corpo = aparada.replace(/[ \t]{2,}/g, " ");
    // TÓPICO DIGITADO (06/11/2026): quem escreve "- Picadinho" está fazendo um
    // tópico. Dentro de um tópico, o traço é um subtópico; numa linha solta, é
    // o próprio tópico. É o que a Marisa chamou de "reconhecer os bullets".
    corpo = corpo
      .replace(/^• ([\u0001\u0002]*) ?[-–] +/, `${RECUO}◦ $1`)
      .replace(/^([\u0001\u0002]*)[-–*] +(?=\S)/, "• $1");
    if (corpo.startsWith(`${RECUO}◦ `)) return corpo;
    return recuo ? recuo[1] + corpo : corpo;
  }).filter((l, i, todas) => !(vazia(l) && topico(todas[i + 1]) && topico(todas[i - 1])));
  // PARÁGRAFOS VAZIOS EM SÉRIE (06/11/2026): o editor deixa um <p></p> a cada
  // Enter a mais, e uma EC chegou com 40 deles — cada um virava uma linha em
  // branco no Excel, e a altura do item ficava desproporcional. Entre dois
  // blocos de texto fica no máximo UMA linha em branco.
  for (let i = linhas.length - 1; i > 0; i--) {
    if (vazia(linhas[i]) && vazia(linhas[i - 1])) linhas.splice(i, 1);
  }
  // E, como antes, sem linha em branco no meio de uma lista de tópicos.
  for (let i = linhas.length - 2; i > 0; i--) {
    if (vazia(linhas[i]) && topico(linhas[i - 1]) && topico(linhas[i + 1])) linhas.splice(i, 1);
  }
  // Linha só de marcadores (um <strong></strong> vazio) conta como vazia.
  while (linhas.length && vazia(linhas[0])) linhas.shift();
  while (linhas.length && vazia(linhas[linhas.length - 1])) linhas.pop();
  return linhas;
}

export function htmlParaLinhas(html: string): string[] {
  return linhasComMarcas(html).map((l) => l.replace(SEM_MARCAS, ""));
}

/** Um trecho de texto com ou sem negrito — o "rich text" do Excel. */
export interface TrechoTexto {
  texto: string;
  negrito: boolean;
}

/**
 * O HTML em trechos, com o NEGRITO preservado (06/11/2026, pedido da Marisa):
 * o Excel aceita texto rico numa célula, e a Descrição Completa perdia o
 * destaque que a pessoa deu na tela. Tópicos e parágrafos seguem a mesma regra
 * de `htmlParaLinhas` — as linhas são separadas por "\n" dentro dos trechos.
 */
export function htmlParaTrechos(html: string): TrechoTexto[] {
  const linhas = linhasComMarcas(html);
  const trechos: TrechoTexto[] = [];
  let negrito = false;
  const juntar = (texto: string) => {
    if (!texto) return;
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.negrito === negrito) ultimo.texto += texto;
    else trechos.push({ texto, negrito });
  };
  linhas.forEach((linha, i) => {
    if (i > 0) juntar("\n");
    let atual = "";
    for (const ch of linha) {
      if (ch === NEG_ABRE || ch === NEG_FECHA) {
        juntar(atual);
        atual = "";
        negrito = ch === NEG_ABRE;
      } else atual += ch;
    }
    juntar(atual);
  });
  return trechos;
}
