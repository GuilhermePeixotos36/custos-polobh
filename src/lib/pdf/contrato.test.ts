// @vitest-environment node
/**
 * O PDF do contrato, aberto por dentro (11/11/2026): o texto do contrato chega
 * ao documento, o título vai no cabeçalho de TODA página, e a paginação não
 * quebra o que não pode quebrar.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { montarContrato } from "@/domain/contratoDocumento";
import { textoDoPdf, type PdfJs } from "@/lib/pdfTexto";
import { gerarContratoPdf } from "./contrato";

const cliente = { nome: "Banco X", razaoSocial: "BANCO X S.A.", cnpjCpf: "11.111.111/0001-11", endereco: "Av. do Cliente, 1 - Belo Horizonte - MG", inscricaoEstadual: "Isenta" } as Cliente;
const empresas = [
  { id: "polobh", nome: "Pólobh", razaoSocial: "Polobh Promoções Ltda.", cnpj: "07128230000180", endereco: "Av. Aggeo Pio Sobrinho, 265 - Buritis, Belo Horizonte - MG, 30575-834", inscricaoEstadual: "003007740.00-11", telefone: "(31) 3333-0000", ordem: 1, padrao: true } as EmpresaGrupo,
];
const os = (modalidade: string, descritivo = "Locação de som.\n- Line array\n- Mesa digital") =>
  ({
    numero: "0031/26",
    fornecedor: { razaoSocial: "CS Comunicação e Arte Ltda", nomeFantasia: "CS", cnpj: "51.411.303/0001-38", inscricaoEstadual: "Isento", telefone: "(31) 98489-2098", endereco: "Rua A, 1 - Centro - Contagem - MG" },
    projeto: { modalidade }, financeiro: { tomador: "polobh", descritivoNf: "Som" },
    contrato: {
      contratante: "", descritivoServicos: descritivo, informacoesComplementares: "", valorUnitario: 2500, quantidade: 1, valorTotal: 2500,
      descontoNegociado: 0, valorAPagar: 2500, formaPagamento: "À vista", observacoesGerais: "", dataContrato: "2026-11-09", rubrica: "",
      projetoIncentivado: "Festival de Inverno", leiIncentivo: "Rouanet", codigoProjetoIncentivado: "PRONAC 26 1234",
    },
  }) as unknown as Os;

const TITULO = "Banco X – Festival 2026 – Som – CS – Contrato (01) em 09 11 26";

async function gerar(modalidade: string, descritivo?: string) {
  const bytes = await gerarContratoPdf(montarContrato(os(modalidade, descritivo), { cliente, empresas, titulo: TITULO }));
  const buf = bytes.slice().buffer as ArrayBuffer;
  return { bytes, doc: await PDFDocument.load(bytes), texto: await textoDoPdf(pdfjs as unknown as PdfJs, buf, 30) };
}

describe("o PDF do contrato", () => {
  it("é um PDF de verdade, com o título do contrato nos metadados", async () => {
    const { bytes, doc } = await gerar("Corporativo");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(doc.getTitle()).toBe(TITULO);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("traz as partes formatadas, os valores em lista e as testemunhas fixas", async () => {
    const { texto } = await gerar("Cultural");
    for (const t of [
      "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      "Polobh Promoções Ltda.",
      "07.128.230/0001-80",
      "003.007.740/0011",
      "(31) 3333-0000",
      "Belo Horizonte - MG",
      "Neste ato representando(a) em conformidade com seu contrato ou estatuto social.",
      "Valor unitário: R$ 2.500,00",
      "Quantidade: 01",
      "Valor Total a Pagar: R$ 2.500,00",
      "FESTIVAL DE INVERNO - ROUANET - PRONAC 26 1234",
      "CLÁUSULA TERCEIRA: DA VIGÊNCIA E DA RESCISÃO",
      "Parágrafo Único",
      "TIAGO ALKIMIM RESENDE",
      "CPF: 057.704.986-09",
      "VIVIANE BARREIROS DOS SANTOS",
      "CPF: 082.218.156-83",
      "por meio eletrônico",
    ]) {
      expect(texto.replace(/\s+/g, " ")).toContain(t);
    }
  });

  it("o Corporativo cita o projeto no objeto e leva o nome dele em caixa alta", async () => {
    const { texto } = await gerar("Corporativo");
    const t = texto.replace(/\s+/g, " ");
    expect(t).toContain("cuja gestão é de responsabilidade do(a) CONTRATANTE, sendo:");
    expect(t).not.toContain("PRONAC");
  });

  it("o cabeçalho com o título e 'pág X de Y' saem em todas as páginas", async () => {
    const { doc, texto } = await gerar("Corporativo");
    const n = doc.getPageCount();
    expect(texto.split(TITULO).length - 1).toBe(n);
    for (let i = 1; i <= n; i++) expect(texto).toContain(`pág ${i} de ${n}`);
  });

  it("o negrito marcado não deixa asteriscos no documento", async () => {
    const { texto } = await gerar("Cultural");
    expect(texto).not.toContain("**");
  });

  it("um descritivo longo pagina sem perder texto", async () => {
    const longo = Array.from({ length: 80 }, (_, i) => `Item ${i + 1}: serviço detalhado número ${i + 1} do evento.`).join("\n");
    const { doc, texto } = await gerar("Corporativo", longo);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(texto).toContain("Item 1: serviço detalhado");
    expect(texto).toContain("Item 80: serviço detalhado");
  });

  it("caracteres que a fonte do PDF não conhece não derrubam a geração", async () => {
    const { texto } = await gerar("Corporativo", "Palco → 10m × 8m ✓ 😀");
    expect(texto).toContain("Palco");
  });
});
