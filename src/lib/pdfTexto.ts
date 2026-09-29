/** Texto de um PDF — sem dependência do navegador nem do banco, para poder ser testado. */

/** O que a biblioteca de PDF precisa oferecer. */
export type PdfJs = Pick<typeof import("pdfjs-dist"), "getDocument">;

/**
 * O TEXTO do PDF, página a página.
 *
 * Orçamento em PDF quase sempre é PDF de verdade, com texto — e ler o texto é
 * mais exato e mais barato do que mandar uma foto da página para a IA ler de
 * volta (que erra vírgula e ponto de valor). A imagem fica para o caso do PDF
 * escaneado, que não tem texto nenhum (ver `resumirProposta`).
 */
export async function textoDoPdf(pdfjsLib: PdfJs, dados: ArrayBuffer, maxPaginas = 10): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(dados) }).promise;
  const paginas: string[] = [];
  const n = Math.min(pdf.numPages, maxPaginas);
  for (let i = 1; i <= n; i++) {
    const conteudo = await (await pdf.getPage(i)).getTextContent();
    let texto = "";
    for (const item of conteudo.items) {
      if (!("str" in item)) continue;
      texto += item.str + (item.hasEOL ? "\n" : " ");
    }
    paginas.push(texto.replace(/[ \t]+\n/g, "\n").trim());
  }
  return paginas.filter(Boolean).join("\n\n");
}

