/**
 * Geração do Cronograma em Excel seguindo o modelo da Pólobh:
 * - Bloco CLIENTE / PROJETO com dados preenchidos automaticamente a partir da EC.
 * - Tabela (Data, Horário, Fornecedor, Descritivo da Contratação, Produtor
 *   Responsável) agrupada por data. Fornecedor e Descritivo vêm da EC; Data,
 *   Horário e Produtor Responsável ficam em branco para a equipe preencher.
 */
import ExcelJS from "exceljs";
import { COR, fill, thin, baixar, nomeArquivo } from "./shared";

export interface CronogramaExcelDados {
  cliente: string;
  titulo: string;
  modalidade: string;
  data: string;
  horario: string;
  local: string;
  enderecoLocal: string;
  dataGrupo: string;
  contratacoes: { fornecedor: string; descritivo: string }[];
  nomeArquivo: string;
}

const CINZA = "FFD9D9D9";
const COLS = ["A", "B", "C", "D", "E"];

export async function gerarCronogramaExcel(d: CronogramaExcelDados): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("Cronograma", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  });
  [18, 14, 28, 62, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let r = 1;

  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:E${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 11, color: { argb: COR.ink } };
    c.fill = fill(CINZA);
    c.alignment = { vertical: "middle", horizontal: "center" };
    COLS.forEach((col) => (ws.getCell(`${col}${r}`).border = thin));
    ws.getRow(r).height = 20;
    r++;
  };

  const lv = (label: string, valor: string) => {
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { bold: true, size: 10 };
    a.border = thin;
    ws.mergeCells(`B${r}:E${r}`);
    const b = ws.getCell(`B${r}`);
    b.value = valor;
    b.font = { size: 10 };
    b.alignment = { wrapText: true, vertical: "middle" };
    ["B", "C", "D", "E"].forEach((col) => (ws.getCell(`${col}${r}`).border = thin));
    r++;
  };

  // ---------- Cabeçalho ----------
  secao("CLIENTE");
  lv("Cliente:", d.cliente);
  secao("PROJETO");
  lv("Título:", d.titulo);
  lv("Modalidade:", d.modalidade);
  lv("Data:", d.data);
  lv("Horário:", d.horario);
  lv("Local:", d.local);
  lv("Endereço do Local:", d.enderecoLocal);

  r++; // linha em branco de respiro

  // ---------- Cabeçalho da tabela ----------
  const headers = ["Data", "Horário", "Fornecedor", "Descritivo da Contratação", "Produtor Responsável"];
  headers.forEach((h, i) => {
    const c = ws.getCell(`${COLS[i]}${r}`);
    c.value = h;
    c.font = { bold: true, size: 11, color: { argb: COR.ink } };
    c.alignment = { vertical: "middle", horizontal: i >= 2 ? "left" : "center", wrapText: true };
    c.border = thin;
  });
  ws.getRow(r).height = 26;
  r++;

  // ---------- Grupo de data ----------
  ws.mergeCells(`A${r}:E${r}`);
  const dg = ws.getCell(`A${r}`);
  dg.value = d.dataGrupo;
  dg.font = { bold: true, size: 11, color: { argb: COR.ink } };
  dg.alignment = { vertical: "middle", horizontal: "center" };
  COLS.forEach((col) => (ws.getCell(`${col}${r}`).border = thin));
  ws.getRow(r).height = 20;
  r++;

  // ---------- Contratações (Fornecedor/Descritivo da EC; resto em branco) ----------
  const linhas = d.contratacoes.length ? d.contratacoes : [{ fornecedor: "", descritivo: "" }];
  for (const it of linhas) {
    const vals = ["", "", it.fornecedor, it.descritivo, ""];
    vals.forEach((v, i) => {
      const c = ws.getCell(`${COLS[i]}${r}`);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { wrapText: true, vertical: "top" };
      c.border = thin;
    });
    ws.getRow(r).height = 34;
    r++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo(d.nomeArquivo)}.xlsx`);
}
