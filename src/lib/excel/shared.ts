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
};

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

/** Carrega o logo (public/) como base64 para embutir no Excel. */
export async function carregarLogo(): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch("/polobh-logo.png");
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}
