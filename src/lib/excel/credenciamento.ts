/**
 * Credenciamento em Excel — a folha da portaria.
 *
 * O que os fornecedores preencheram no formulário público só existia dentro da
 * tela, um bloco por fornecedor. No dia do evento a informação é usada de outro
 * jeito: uma folha impressa na portaria, conferida nome a nome, e outra para os
 * veículos que entram na doca. Por isso duas tabelas achatadas e não a estrutura
 * por OS em que o dado chega.
 *
 * A lista de quem NÃO respondeu sai junto, no fim: sem ela, a ausência de um
 * nome na portaria vira dúvida ("não mandaram, ou esta pessoa não podia vir?").
 */
import ExcelJS from "exceljs";
import { COR, fill, thin, baixar, nomeArquivo } from "./shared";
import type { PessoaCredenciada, VeiculoCredenciado } from "@/domain/credenciamento";

export interface CredenciamentoExcelDados {
  cliente: string;
  titulo: string;
  evento: string;
  local: string;
  equipe: PessoaCredenciada[];
  veiculos: VeiculoCredenciado[];
  semResposta: string[];
  nomeArquivo: string;
}

const CINZA = "FFD9D9D9";
const COLS = ["A", "B", "C", "D"];
/** Fornecedor, nome, documento, função — largura pensada para leitura em papel. */
const LARGURAS = [26, 34, 20, 26];

export async function criarCredenciamentoBuffer(d: CredenciamentoExcelDados): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("Credenciamento", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  LARGURAS.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let r = 1;

  const faixa = (txt: string) => {
    ws.mergeCells(`A${r}:D${r}`);
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
    ws.mergeCells(`B${r}:D${r}`);
    const b = ws.getCell(`B${r}`);
    b.value = valor;
    b.font = { size: 10 };
    b.alignment = { wrapText: true, vertical: "middle" };
    COLS.slice(1).forEach((col) => (ws.getCell(`${col}${r}`).border = thin));
    r++;
  };

  const cabecalhoTabela = (titulos: string[]) => {
    titulos.forEach((h, i) => {
      const c = ws.getCell(`${COLS[i]}${r}`);
      c.value = h;
      c.font = { bold: true, size: 11, color: { argb: COR.ink } };
      c.fill = fill(CINZA);
      c.alignment = { vertical: "middle", horizontal: "left" };
      c.border = thin;
    });
    // As colunas não usadas pela tabela ainda recebem a borda, para a faixa
    // fechar na mesma largura das outras.
    COLS.slice(titulos.length).forEach((col) => {
      const c = ws.getCell(`${col}${r}`);
      c.fill = fill(CINZA);
      c.border = thin;
    });
    ws.getRow(r).height = 22;
    r++;
  };

  const linhaDados = (valores: string[]) => {
    COLS.forEach((col, i) => {
      const c = ws.getCell(`${col}${r}`);
      c.value = valores[i] ?? "";
      c.font = { size: 10, bold: i === 0 };
      c.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
      c.border = thin;
    });
    ws.getRow(r).height = 20;
    r++;
  };

  faixa("CREDENCIAMENTO — LISTA DE ACESSO");
  lv("Cliente:", d.cliente);
  lv("Projeto:", d.titulo);
  lv("Evento:", d.evento);
  lv("Local:", d.local);

  r++;
  faixa("EQUIPE");
  /*
   * As colunas seguem o que este evento PEDIU (15/09/2026): o credenciamento
   * escolhe os campos, e uma coluna que ninguém preencheu é espaço gasto na
   * folha que a portaria confere nome a nome. Fornecedor e Nome são sempre
   * colunas — sem os dois, a linha não identifica ninguém.
   */
  const OPCIONAIS: { chave: keyof PessoaCredenciada; rotulo: string }[] = [
    { chave: "cpf", rotulo: "CPF" },
    { chave: "rg", rotulo: "RG" },
    { chave: "funcao", rotulo: "Função" },
    { chave: "telefone", rotulo: "Telefone" },
    { chave: "aniversario", rotulo: "Aniversário" },
    { chave: "endereco", rotulo: "Endereço" },
  ];
  const usadas = OPCIONAIS.filter(({ chave }) => d.equipe.some((p) => String(p[chave] ?? "").trim() !== ""));
  cabecalhoTabela(["Fornecedor", "Nome", ...usadas.map((c) => c.rotulo)]);
  const cabecalhoEquipe = r - 1;
  if (d.equipe.length) {
    for (const p of d.equipe) {
      linhaDados([p.fornecedor, p.nome, ...usadas.map((c) => String(p[c.chave] ?? ""))]);
    }
  } else {
    linhaDados(["(nenhum credenciamento recebido)"]);
  }
  // Congela no cabeçalho da EQUIPE: é a tabela longa, a que passa da página.
  ws.views = [{ state: "frozen", ySplit: cabecalhoEquipe, showGridLines: false }];

  r++;
  faixa("VEÍCULOS");
  cabecalhoTabela(["Fornecedor", "Modelo", "Placa"]);
  if (d.veiculos.length) {
    for (const v of d.veiculos) linhaDados([v.fornecedor, v.modelo, v.placa]);
  } else {
    linhaDados(["(nenhum veículo informado)"]);
  }

  if (d.semResposta.length) {
    r++;
    faixa("AINDA NÃO RESPONDERAM");
    for (const nome of d.semResposta) linhaDados([nome]);
  }

  ws.pageSetup.printArea = `A1:D${r - 1}`;
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function gerarCredenciamentoExcel(d: CredenciamentoExcelDados): Promise<void> {
  baixar(await criarCredenciamentoBuffer(d), `${nomeArquivo(d.nomeArquivo)}.xlsx`);
}
