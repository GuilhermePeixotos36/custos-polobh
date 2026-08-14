import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { criarEcExcelBuffer } from "./ec";
import { encaixarLogo, linhasVisuais } from "./shared";
import { honorariosPadrao, encargosPadrao, producaoZerada } from "@/domain/calc";
import type { Ec, EcLinha } from "@/data/types";
import { projetoInfoVazio } from "@/domain/projeto";

/** O gerador busca a logo por fetch("/polobh-logo.png"); em teste servimos o arquivo real. */
beforeAll(() => {
  const png = readFileSync(resolve(process.cwd(), "public/polobh-logo.png"));
  globalThis.fetch = (async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })) as unknown as typeof fetch;
});

const linha = (p: Partial<EcLinha>): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Item", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0, statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
  codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const ecBase = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – Teste – V01", slugPublico: "", versao: 1, status: "Rascunho",
  projetoId: "p1", template: "Cultural", clienteId: "c1",
  cliente: {
    id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "ACME LTDA", endereco: "Rua X, 100",
    cnpjCpf: "12.345.678/0001-95", inscricaoEstadual: "", inscricaoMunicipal: "",
    representante: { nome: "Fulano", cargo: "Diretor", telefones: "(31) 99999-0000", email: "f@acme.com" },
  },
  projeto: { ...projetoInfoVazio(), titulo: "Convenção 2026", local: "Teatro" },
  linhas, producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "Marisa", validadeDias: 30, criadoEm: "2026-02-22", atualizadoEm: "2026-02-22", ativa: true,
});

async function abrir(ec: Ec, modelo: "completa" | "financeiro" = "completa") {
  const { buffer, nome } = await criarEcExcelBuffer(ec, modelo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return { ws: wb.getWorksheet("EC")!, wb, nome };
}

describe("Excel da EC", () => {
  it("usa apenas 'Estimativa de Custos | Proposta Comercial' como título", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    expect(ws.getCell("C1").value).toBe("Estimativa de Custos | Proposta Comercial");
    // O título da EC continua disponível, na linha de identificação.
    const identificacao = ws.getCell("B4").value;
    expect(String(identificacao)).toContain("Convenção 2026");
  });

  it("embute a logo preservando a proporção do arquivo", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    const imagens = ws.getImages();
    expect(imagens).toHaveLength(1);
    // `ext` existe no anchor gravado, mas não está no tipo público do ExcelJS.
    const { width, height } = (imagens[0].range as unknown as { ext: { width: number; height: number } }).ext;
    const png = readFileSync(resolve(process.cwd(), "public/polobh-logo.png"));
    const proporcaoArquivo = png.readUInt32BE(16) / png.readUInt32BE(20);
    expect(width / height).toBeCloseTo(proporcaoArquivo, 1);
  });

  it("dá altura às linhas com texto longo, para não cortar conteúdo", async () => {
    const descricaoLonga = "Contratação de serviços de buffet, sendo: ".repeat(12);
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", descricao: descricaoLonga, valorPolobh: 1000 })]));
    let alturaDoItem = 0;
    ws.eachRow((row) => {
      if (String(row.getCell("A").value ?? "") === "Buffet") alturaDoItem = Number(row.height ?? 0);
    });
    expect(alturaDoItem).toBeGreaterThan(30);
  });

  it("não escreve barras nas datas automáticas", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    const comData = textos.filter((t) => /\d{2}\s\d{2}\s\d{2}/.test(t));
    expect(comData.length).toBeGreaterThan(0);
    expect(textos.some((t) => /\d{2}\/\d{2}\/\d{2}/.test(t))).toBe(false);
  });

  it("mostra a taxa mínima no rótulo quando ela é a que vale", async () => {
    const ec = ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]);
    ec.honorarios = { modo: "percentual", valor: 0.15, minimo: 5000 };
    const { ws } = await abrir(ec);
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    expect(textos.some((t) => t.includes("taxa mínima") && t.includes("mínimo aplicado"))).toBe(true);
  });

  it("gera o modelo financeiro sem quebrar", async () => {
    const { ws, nome } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]), "financeiro");
    expect(ws.rowCount).toBeGreaterThan(10);
    expect(nome).toBeTruthy();
  });
});

describe("helpers de layout do Excel", () => {
  it("encaixarLogo respeita a proporção e a caixa", () => {
    const ext = encaixarLogo({ buffer: new Uint8Array(0), largura: 523, altura: 190 }, { largura: 170, altura: 54 });
    expect(ext.height).toBeLessThanOrEqual(54);
    expect(ext.width).toBeLessThanOrEqual(170);
    expect(ext.width / ext.height).toBeCloseTo(523 / 190, 1);
  });

  it("linhasVisuais conta quebras manuais e estouro de largura", () => {
    expect(linhasVisuais("", 20)).toBe(1);
    expect(linhasVisuais("a\nb\nc", 20)).toBe(3);
    expect(linhasVisuais("x".repeat(60), 20)).toBeGreaterThan(2);
  });
});
