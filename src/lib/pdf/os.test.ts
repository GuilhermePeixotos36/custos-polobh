import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { gerarOsPdf } from "./os";
import type { OsDocumentoModelo } from "@/domain/osDocumento";

const modelo = (descritivo: string): OsDocumentoModelo => ({
  assinaturaFornecedor: "Som Teste Ltda",
  id: "0036",
  blocos: [
    { t: "lv", label: "OS", valor: "BM – Convenção de Vendas 2027 – Sonorização – Som Teste – (Som Teste Ltda) – OS (01) em 27 11 26" },
    { t: "lv", label: "Status", valor: "Emitida" },
    {
      t: "lista", label: "Cronograma do Projeto",
      grupos: [
        { titulo: "Montagem", itens: [{ a: "25/11/2026", b: "08:00 às 18:00" }, { a: "26/11/2026", b: "08:00 às 12:00" }] },
        { titulo: "Evento", itens: [{ a: "27/11/2026", b: "19:00 às 23:00" }] },
        { titulo: "Desmontagem", itens: [{ a: "28/11/2026", b: "" }] },
      ],
    },
    { t: "secao", titulo: "Dados do Fornecedor" },
    { t: "lv", label: "Perfil (MEI / Simples / etc.)", valor: "Simples Nacional" },
    { t: "lv", label: "Dados bancários", valor: "Banco do Brasil  ·  Ag. 1234  ·  Conta 56789-0" },
    { t: "secao", titulo: "Detalhamento da Contratação" },
    { t: "lv", label: "Descritivo", valor: descritivo },
    { t: "secao", titulo: "Cronograma Específico do Fornecedor" },
    {
      t: "tabela", estilo: "escuro", primeiraEmDestaque: true, vazio: "Sem etapas cadastradas.",
      colunas: [{ titulo: "Etapa", largura: 0.26 }, { titulo: "Data", largura: 0.18 }, { titulo: "Horário", largura: 0.16 }, { titulo: "Atividades" }],
      linhas: [["Montagem", "27/11/2026", "08h às 12h", "Montagem do sistema de som, passagem de cabos e teste de todos os canais com a equipe técnica do teatro"]],
    },
    { t: "secao", titulo: "Resumo dos Custos" },
    {
      t: "tabela", estilo: "claro",
      colunas: [{ titulo: "Item" }, { titulo: "Com BV e NF", largura: 0.3, direita: true }, { titulo: "Sem BV e Sem NF", largura: 0.3, direita: true }],
      linhas: [["Sonorização Geral", "R$ 12.000,00", "Não se aplica"]],
      rodape: ["Total por forma de cobrança", "R$ 12.000,00", "R$ 0,00"],
    },
    { t: "destaque", titulo: "Retenções Fiscais", texto: "Informar na nota as retenções de ISS, IRRF e INSS quando houver.\nSem retenção, declarar na nota." },
  ],
});

describe("gerarOsPdf", () => {
  it("gera um PDF de uma página com o conteúdo curto", async () => {
    const bytes = await gerarOsPdf(modelo("Sonorização completa do evento."), "OS de teste");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("OS de teste");
    if (process.env.OS_PDF_SAIDA) writeFileSync(process.env.OS_PDF_SAIDA, bytes);
  });

  it("valor comprido continua na página seguinte, sem travar", async () => {
    const longo = Array.from({ length: 160 }, (_, i) => `Linha ${i + 1} do descritivo dos serviços contratados.`).join("\n");
    const doc = await PDFDocument.load(await gerarOsPdf(modelo(longo), "OS longa"));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it("caractere fora do alfabeto da fonte não derruba o arquivo", async () => {
    const bytes = await gerarOsPdf(modelo("Palco 10 m² → entrega 😀 às 8h"), "OS");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
