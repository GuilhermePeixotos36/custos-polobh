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

export function baixar(buffer: ArrayBuffer, nome: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
