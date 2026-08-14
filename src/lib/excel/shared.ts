import ExcelJS from "exceljs";

/** Paleta Pólobh em ARGB (ExcelJS usa AARRGGBB). */
export const COR = {
  black: "FF0B0B0D",
  ink: "FF15161A",
  white: "FFFFFFFF",
  primary: "FFF2820D",
  amber: "FFFBB040",
  soft: "FFFDF1E3",
  border: "FFE7E8EC",
  borderSoft: "FFEEEFF2",
  zebra: "FFFAFAFB",
  ink2: "FF6A6E78",
  // Cinzas do padrão da EC original Pólobh (no lugar das barras pretas).
  headerGray: "FF595959", // cabeçalhos (título geral e cabeçalho da tabela) — texto branco
  groupGray: "FFD9D9D9",  // barras de nome de grupo — texto escuro em destaque
  gridLine: "FFBFBFBF",   // linhas da grade (mais visível que a borda suave)
  // Extraídas da EC original da Pólobh (reference/*.xlt) — usadas no lib/excel/ec.ts.
  sectionGray: "FFC0C0C0", // barras CLIENTE / PROJETO / nome do grupo (cinza real do modelo)
  rotuloGray: "FFF2F2F2",  // fundo da coluna de rótulos nas linhas "RÓTULO | VALOR" da OS
  gold: "FFFFCC00",        // destaque ESTIMATIVA DE CUSTOS e Valor Total Bruto
  statusBlue: "FF99CCFF",  // colunas de status/documentação (Status, Fornecedor, Documento PG, Código, Pedido)
};

/** Fontes da EC original da Pólobh (Excel usa fonte substituta automaticamente se não instalada). */
export const FONT_BOLD = "Futura PT Bold";
export const FONT_LIGHT = "Futura PT Light";

export const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

export const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COR.border } },
  left: { style: "thin", color: { argb: COR.border } },
  bottom: { style: "thin", color: { argb: COR.border } },
  right: { style: "thin", color: { argb: COR.border } },
};

/** Grade visível (separa colunas e linhas) — padrão da EC original Pólobh. */
export const grade: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COR.gridLine } },
  left: { style: "thin", color: { argb: COR.gridLine } },
  bottom: { style: "thin", color: { argb: COR.gridLine } },
  right: { style: "thin", color: { argb: COR.gridLine } },
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function baixar(buffer: ArrayBuffer, nome: string) {
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Salva com o seletor de pasta do sistema (File System Access API) — abre o
 * diálogo do Windows Explorer para o usuário escolher a pasta/nome. Quando o
 * navegador não suporta (ex.: Firefox), cai no download normal.
 * Retorna "salvo" | "cancelado" | "baixado".
 */
export async function salvarComPicker(buffer: ArrayBuffer, nome: string): Promise<"salvo" | "cancelado" | "baixado"> {
  const nomeArq = nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: nomeArq,
        types: [{ description: "Planilha Excel", accept: { [XLSX_MIME]: [".xlsx"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([buffer], { type: XLSX_MIME }));
      await writable.close();
      return "salvo";
    } catch (e) {
      // Usuário cancelou o diálogo
      if ((e as Error)?.name === "AbortError") return "cancelado";
      // Qualquer outra falha → download normal
      baixar(buffer, nomeArq);
      return "baixado";
    }
  }
  baixar(buffer, nomeArq);
  return "baixado";
}

/** Nome de arquivo seguro a partir do número do documento. */
export const nomeArquivo = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

/**
 * Logo com as dimensões REAIS do arquivo — sem elas a imagem sai esticada.
 * O conteúdo vai como `Uint8Array`, o único formato que o ExcelJS aceita tanto
 * no navegador quanto no Node (onde rodam os testes).
 */
export interface LogoPolobh {
  buffer: Uint8Array;
  largura: number;
  altura: number;
}

/** Lê largura/altura do cabeçalho IHDR de um PNG (bytes 16..23). */
function dimensoesPng(bytes: Uint8Array): { largura: number; altura: number } | null {
  if (bytes.byteLength < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A.
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < assinatura.length; i++) if (view.getUint8(i) !== assinatura[i]) return null;
  return { largura: view.getUint32(16), altura: view.getUint32(20) };
}

/**
 * Carrega o logo (public/polobh-logo.png) já com as dimensões do arquivo.
 *
 * As medidas vêm do próprio PNG justamente para o desenho nunca ser distorcido:
 * trocar o arquivo por outra versão do logo (proporção diferente, com ou sem
 * slogan) passa a funcionar sozinho, sem mexer no código.
 */
export async function carregarLogo(): Promise<LogoPolobh | null> {
  try {
    const r = await fetch("/polobh-logo.png");
    if (!r.ok) return null;
    const buffer = new Uint8Array(await r.arrayBuffer());
    const dim = dimensoesPng(buffer);
    if (!dim) return null;
    return { buffer, ...dim };
  } catch {
    return null;
  }
}

/**
 * Escala o logo para caber numa caixa, preservando a proporção original.
 * Devolve as medidas em pixels que o ExcelJS espera em `ext`.
 */
export function encaixarLogo(logo: LogoPolobh, caixa: { largura: number; altura: number }) {
  const escala = Math.min(caixa.largura / logo.largura, caixa.altura / logo.altura);
  return { width: Math.round(logo.largura * escala), height: Math.round(logo.altura * escala) };
}

/**
 * Estima quantas linhas visuais um texto ocupa numa célula de `largura` colunas
 * (unidade de largura do Excel ≈ 1 caractere), considerando as quebras manuais.
 * É a base do ajuste de altura das linhas: sem isso o texto longo fica cortado,
 * porque o Excel só auto-ajusta a altura de linhas que ele mesmo escreveu.
 */
export function linhasVisuais(texto: string, largura: number): number {
  if (!texto) return 1;
  const porLinha = Math.max(8, Math.floor(largura) - 1);
  return String(texto)
    .split("\n")
    .reduce((n, paragrafo) => n + Math.max(1, Math.ceil(paragrafo.length / porLinha)), 0);
}

/** Altura máxima de linha no Excel (em pontos) — limite real do formato .xlsx. */
export const ALTURA_MAX_LINHA = 409.5;

/** Converte um número de linhas visuais em altura de linha (pontos), com folga. */
export const alturaParaLinhas = (linhas: number, ptPorLinha = 12.6, folga = 4): number =>
  Math.min(ALTURA_MAX_LINHA, Math.max(15, linhas * ptPorLinha + folga));
