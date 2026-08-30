import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { criarCredenciamentoBuffer, type CredenciamentoExcelDados } from "./credenciamento";

const base: CredenciamentoExcelDados = {
  cliente: "ACME Eventos",
  titulo: "Convenção 2026",
  evento: "10/09/2026",
  local: "Teatro Sesiminas — Av. Afonso Pena, 1000",
  equipe: [
    { fornecedor: "Som & Luz", nome: "Ana Ribeiro", cpf: "111.222.333-44", funcao: "Técnica de som" },
    { fornecedor: "Som & Luz", nome: "Bruno Dias", cpf: "555.666.777-88", funcao: "Roadie" },
  ],
  veiculos: [{ fornecedor: "Som & Luz", modelo: "Sprinter branca", placa: "ABC1D23" }],
  semResposta: ["Buffet Sabor"],
  nomeArquivo: "Credenciamento - Convenção",
};

async function abrir(d: Partial<CredenciamentoExcelDados> = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await criarCredenciamentoBuffer({ ...base, ...d }));
  const ws = wb.getWorksheet("Credenciamento")!;
  const linhas: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    const partes: string[] = [];
    row.eachCell({ includeEmpty: false }, (c) => {
      if (c.value !== null && c.value !== undefined && c.value !== "") partes.push(String(c.value));
    });
    linhas[i] = partes.join(" | ");
  });
  return { ws, linhas, texto: linhas.filter(Boolean).join("\n") };
}

describe("planilha de credenciamento", () => {
  it("traz o cabeçalho do evento e as duas tabelas", async () => {
    const { texto } = await abrir();
    expect(texto).toContain("CREDENCIAMENTO");
    expect(texto).toContain("Convenção 2026");
    expect(texto).toContain("Teatro Sesiminas");
    expect(texto).toContain("EQUIPE");
    expect(texto).toContain("VEÍCULOS");
  });

  it("cada pessoa é uma linha, com o fornecedor ao lado — é o que a portaria confere", async () => {
    const { texto } = await abrir();
    expect(texto).toContain("Som & Luz | Ana Ribeiro | 111.222.333-44 | Técnica de som");
    expect(texto).toContain("Som & Luz | Bruno Dias");
    expect(texto).toContain("Som & Luz | Sprinter branca | ABC1D23");
  });

  /** Sem esta lista, a ausência de um nome na portaria vira dúvida. */
  it("nomeia quem ainda não respondeu", async () => {
    const { texto } = await abrir();
    expect(texto).toContain("AINDA NÃO RESPONDERAM");
    expect(texto).toContain("Buffet Sabor");
  });

  it("sem ninguém pendente, a seção não aparece", async () => {
    const { texto } = await abrir({ semResposta: [] });
    expect(texto).not.toContain("AINDA NÃO RESPONDERAM");
  });

  it("sem resposta nenhuma, a folha sai assim mesmo dizendo que está vazia", async () => {
    const { texto } = await abrir({ equipe: [], veiculos: [] });
    expect(texto).toContain("nenhum credenciamento recebido");
    expect(texto).toContain("nenhum veículo informado");
  });

  it("congela o cabeçalho da equipe — a folha passa da página num evento grande", async () => {
    const { ws } = await abrir();
    const vista = ws.views[0] as { state?: string; ySplit?: number };
    expect(vista.state).toBe("frozen");
    expect(vista.ySplit).toBeGreaterThan(0);
  });
});
