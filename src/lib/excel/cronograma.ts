/**
 * Geração do Cronograma em Excel seguindo o modelo da Pólobh:
 * - Bloco CLIENTE / PROJETO com dados preenchidos automaticamente a partir da EC.
 * - Tabela (Data, Horário, Fornecedor, Descritivo da Contratação, Produtor
 *   Responsável) com UMA linha por etapa/contratação — cada linha traz a sua
 *   própria Data e Horário (não há mais data geral mesclada). Produtor fica em
 *   branco para a equipe preencher.
 */
import ExcelJS from "exceljs";
import { COR, fill, thin, baixar, nomeArquivo } from "./shared";

export interface CronogramaLinha {
  data: string; // já formatada (dd/mm/aaaa) ou vazia
  horario: string;
  fornecedor: string;
  descritivo: string;
  produtor: string;
}

export interface CronogramaExcelDados {
  cliente: string;
  titulo: string;
  modalidade: string;
  data: string;
  horario: string;
  local: string;
  enderecoLocal: string;
  itens: CronogramaLinha[];
  nomeArquivo: string;
  /** Projeto dono: liga a cópia automática na pasta Dropbox dele. */
  projetoId?: string;
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
  [18, 16, 28, 60, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
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
    c.fill = fill(CINZA);
    c.alignment = { vertical: "middle", horizontal: i >= 2 ? "left" : "center", wrapText: true };
    c.border = thin;
  });
  ws.getRow(r).height = 26;
  r++;

  // ---------- Uma linha por etapa/contratação (Data e Horário por item) ----------
  const linhas = d.itens.length ? d.itens : [{ data: "", horario: "", fornecedor: "", descritivo: "", produtor: "" }];
  for (const it of linhas) {
    const vals = [it.data, it.horario, it.fornecedor, it.descritivo, it.produtor];
    vals.forEach((v, i) => {
      const c = ws.getCell(`${COLS[i]}${r}`);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { wrapText: true, vertical: "top", horizontal: i <= 1 ? "center" : "left" };
      c.border = thin;
    });
    ws.getRow(r).height = 30;
    r++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo(d.nomeArquivo)}.xlsx`, d.projetoId);
}
