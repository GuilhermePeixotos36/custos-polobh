/**
 * Dados Úteis em Excel — a folha de contatos do evento, para imprimir.
 *
 * Mesma peça que a aba Fornecedores do projeto mostra na tela (ver
 * `domain/dadosUteis`), no formato em que ela é de fato usada: uma folha na
 * prancheta do produtor no dia da montagem. Por isso paisagem, colunas largas
 * e nada de CNPJ nem de valor — na hora de ligar para alguém isso é ruído.
 */
import ExcelJS from "exceljs";
import { COR, fill, thin, baixar, nomeArquivo } from "./shared";
import type { LinhaDadosUteis } from "@/domain/dadosUteis";

export interface DadosUteisExcel {
  cliente: string;
  titulo: string;
  evento: string;
  local: string;
  fornecedores: LinhaDadosUteis[];
  nomeArquivo: string;
}

const CINZA = "FFD9D9D9";
const COLS = ["A", "B", "C", "D", "E"];
/** Larguras medidas pelo conteúdo: nome curto, lista de itens, pessoa, telefone, e-mail. */
const LARGURAS = [26, 46, 24, 20, 34];

export async function criarDadosUteisBuffer(d: DadosUteisExcel): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("Dados Úteis", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  LARGURAS.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let r = 1;

  const faixa = (txt: string) => {
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
    COLS.slice(1).forEach((col) => (ws.getCell(`${col}${r}`).border = thin));
    r++;
  };

  faixa("DADOS ÚTEIS — FORNECEDORES DO PROJETO");
  lv("Cliente:", d.cliente);
  lv("Projeto:", d.titulo);
  lv("Evento:", d.evento);
  lv("Local:", d.local);

  r++; // respiro entre o cabeçalho e a tabela

  const titulos = ["Nome Fantasia", "Itens da EC", "Nome", "Telefone", "E-mail"];
  titulos.forEach((h, i) => {
    const c = ws.getCell(`${COLS[i]}${r}`);
    c.value = h;
    c.font = { bold: true, size: 11, color: { argb: COR.ink } };
    c.fill = fill(CINZA);
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c.border = thin;
  });
  // Congela o cabeçalho da tabela: a folha de um evento grande passa da página,
  // e rolar sem os títulos das colunas é o mesmo problema que a tela tinha.
  ws.views = [{ state: "frozen", ySplit: r, showGridLines: false }];
  ws.getRow(r).height = 24;
  r++;

  const linhas = d.fornecedores.length
    ? d.fornecedores
    : [{ fornecedor: "(nenhum fornecedor com OS neste projeto)", itens: [], contato: "", telefone: "", email: "", oss: [] }];

  for (const f of linhas) {
    // Um item por linha dentro da célula: a lista corrida vira um bloco de texto
    // impossível de bater com o olho.
    const valores = [f.fornecedor, f.itens.join("\n"), f.contato, f.telefone, f.email];
    valores.forEach((v, i) => {
      const c = ws.getCell(`${COLS[i]}${r}`);
      c.value = v;
      c.font = { size: 10, bold: i === 0 };
      c.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
      c.border = thin;
    });
    ws.getRow(r).height = Math.max(22, 14 * Math.max(1, f.itens.length));
    r++;
  }

  ws.pageSetup.printArea = `A1:E${r - 1}`;
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function gerarDadosUteisExcel(d: DadosUteisExcel): Promise<void> {
  baixar(await criarDadosUteisBuffer(d), `${nomeArquivo(d.nomeArquivo)}.xlsx`);
}
