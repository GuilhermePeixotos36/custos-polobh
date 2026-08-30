import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { criarDadosUteisBuffer } from "./dadosUteis";

const folha = [
  {
    fornecedor: "Som & Luz",
    itens: ["Sonorização", "Iluminação cênica"],
    contato: "Beltrano",
    telefone: "(31) 97777-0000",
    email: "contato@somluz.com.br",
    oss: ["OS 01"],
  },
  {
    fornecedor: "Buffet Sabor",
    itens: ["Coffee break"],
    contato: "",
    telefone: "(31) 96666-0000",
    email: "",
    oss: ["OS 02"],
  },
];

async function abrir(fornecedores = folha) {
  const buffer = await criarDadosUteisBuffer({
    cliente: "ACME Eventos",
    titulo: "Convenção 2026",
    evento: "10/09/2026",
    local: "Teatro Sesiminas — Av. Afonso Pena, 1000",
    fornecedores,
    nomeArquivo: "Dados Uteis - Convenção",
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Dados Úteis")!;
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

describe("planilha Dados Úteis", () => {
  it("traz o cabeçalho do projeto e as cinco colunas pedidas", async () => {
    const { texto } = await abrir();
    expect(texto).toContain("DADOS ÚTEIS");
    expect(texto).toContain("ACME Eventos");
    expect(texto).toContain("Convenção 2026");
    expect(texto).toContain("Teatro Sesiminas");
    expect(texto).toContain("Nome Fantasia");
    expect(texto).toContain("Itens da EC");
    expect(texto).toContain("Telefone");
    expect(texto).toContain("E-mail");
  });

  it("cada fornecedor vira uma linha, com os itens um por linha na célula", async () => {
    const { texto } = await abrir();
    expect(texto).toContain("Som & Luz");
    expect(texto).toContain("Sonorização\nIluminação cênica");
    expect(texto).toContain("(31) 97777-0000");
    expect(texto).toContain("Buffet Sabor");
  });

  /**
   * A folha é impressa e passa da página num evento grande: sem o congelamento,
   * a segunda página vira uma tabela sem nomes de coluna.
   */
  it("congela o cabeçalho da tabela", async () => {
    const { ws } = await abrir();
    const vista = ws.views[0] as { state?: string; ySplit?: number };
    expect(vista.state).toBe("frozen");
    expect(vista.ySplit).toBeGreaterThan(0);
  });

  it("projeto sem fornecedor gera a folha assim mesmo, dizendo que está vazia", async () => {
    const { texto } = await abrir([]);
    expect(texto).toContain("nenhum fornecedor");
  });
});
