/**
 * O Word do contrato, aberto por dentro (11/11/2026): confere que a estrutura
 * nova está no arquivo — as tabelas de qualificação e de valores, o cabeçalho
 * das páginas seguintes, "pág X de Y" — e que nenhum dado da OS se perdeu.
 */
import JSZip from "jszip";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { montarContrato } from "@/domain/contratoDocumento";
import { documentoDoContrato } from "./contrato";

const cliente = { nome: "Banco X", razaoSocial: "BANCO X S.A.", cnpjCpf: "11.111.111/0001-11", endereco: "Av. do Cliente, 1 - Centro - Belo Horizonte - MG", inscricaoEstadual: "Isenta" } as Cliente;
const empresas = [
  { id: "polobh", nome: "Pólobh", razaoSocial: "PÓLOBH PROMOÇÕES LTDA", cnpj: "22.222.222/0001-22", endereco: "Rua da Casa, 2 - Savassi - Belo Horizonte - MG", inscricaoEstadual: "Isenta", ordem: 1, padrao: true } as EmpresaGrupo,
];
const os = (modalidade: string) =>
  ({
    numero: "0031/26",
    fornecedor: { razaoSocial: "SOM E LUZ LTDA", nomeFantasia: "Som & Luz", cnpj: "33.333.333/0001-33", inscricaoEstadual: "Isenta", telefone: "(31) 99999-0000", endereco: "Rua do Fornecedor, 3 - Centro - Contagem - MG" },
    projeto: { modalidade },
    financeiro: { tomador: "polobh", descritivoNf: "Sonorização do evento" },
    contrato: {
      contratante: "",
      descritivoServicos: "Locação de som.\n- Line array\n- Mesa digital",
      informacoesComplementares: "",
      valorUnitario: 10_000,
      valorTotal: 10_000,
      descontoNegociado: 500,
      valorAPagar: 9_500,
      formaPagamento: "À vista",
      dataContrato: "2026-09-21",
      rubrica: "",
      projetoIncentivado: "Festival de Inverno",
      leiIncentivo: "Rouanet",
      codigoProjetoIncentivado: "PRONAC 26 1234",
    },
  }) as unknown as Os;

async function abrir(modalidade: string) {
  const buf = await Packer.toBuffer(documentoDoContrato(montarContrato(os(modalidade), { cliente, empresas })));
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml")!.async("string");
  const partes = await Promise.all(
    Object.keys(zip.files)
      .filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))
      .map(async (n) => zip.file(n)!.async("string"))
  );
  const texto = (xml: string) => xml.replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "\u0000").replace(/\u0000+/g, " ").replace(/ /g, " ");
  return { xml: doc, texto: texto(doc), rodapes: partes.join("\n") };
}

describe("o .docx do contrato", () => {
  it("leva os dados das duas partes e os valores", async () => {
    const { texto } = await abrir("Corporativo");
    for (const t of ["PÓLOBH PROMOÇÕES LTDA", "SOM E LUZ LTDA", "33.333.333/0001-33", "Município", "Valor Total a Pagar", "R$ 9.500,00", "Forma de pagamento:", "À vista"]) {
      expect(texto).toContain(t);
    }
  });

  it("qualificação e valores são tabelas; as sete cláusulas têm tarja", async () => {
    const { xml, texto } = await abrir("Corporativo");
    // título + 2 partes + valores + 7 tarjas + assinaturas
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(1 + 2 + 1 + 7 + 1);
    for (const n of ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA"]) expect(texto).toContain(`CLÁUSULA ${n}`);
  });

  it("assinaturas e testemunhas numa tabela que não se parte, com a data colada em cima", async () => {
    const { xml } = await abrir("Corporativo");
    const fecho = xml.indexOf("E por estarem assim justas");
    const ultimaTabela = xml.lastIndexOf("<w:tbl>");
    expect(fecho).toBeGreaterThan(0);
    expect(ultimaTabela).toBeGreaterThan(fecho);
    expect(xml.slice(fecho, ultimaTabela)).toContain("<w:keepNext/>");
    expect(xml.slice(ultimaTabela).match(/<w:cantSplit\/>/g)?.length).toBe(2);
  });

  it("a lista das obrigações usa marcador, e a linha '- ' do descritivo também", async () => {
    const { xml } = await abrir("Corporativo");
    // 2 + 2 da Cláusula Segunda (Corporativo) + 2 do descritivo
    expect((xml.match(/<w:numPr>/g) ?? []).length).toBe(6);
  });

  it("páginas seguintes têm cabeçalho com a OS, e todas têm 'pág X de Y'", async () => {
    const { rodapes, xml } = await abrir("Corporativo");
    expect(xml).toContain("<w:titlePg/>");
    expect(rodapes).toContain("OS 0031/26");
    expect(rodapes).toContain("NUMPAGES");
  });

  it("o Cultural leva o projeto incentivado na Cláusula Primeira", async () => {
    const { texto } = await abrir("Cultural");
    expect(texto).toContain("Festival de Inverno");
    expect(texto).toContain("PRONAC 26 1234");
  });
});
