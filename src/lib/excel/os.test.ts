import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { criarOsExcelBuffer } from "./os";
import { honorariosPadrao, encargosPadrao, producaoZerada } from "@/domain/calc";
import { projetoInfoVazio } from "@/domain/projeto";
import type { Ec, EcLinha, Os } from "@/data/types";

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
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, opcaoValor: "",
  statusAprovacao: "OK", fornecedorRazao: "Som & Luz LTDA", fornecedorCnpj: "12.345.678/0001-95",
  fornecedorContato: "", faturaNf: "Nota Fiscal", codigoServico: "17.02", pedidoCompra: "PC-1",
  statusOs: "OK", contratoStatus: "OK", observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const ec = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "", versao: 1, status: "Aprovada",
  projetoId: "p1", template: "Cultural", clienteId: "c1",
  cliente: {
    id: "c1", apelido: "ACME", nome: "ACME Eventos", razaoSocial: "ACME Eventos LTDA",
    endereco: "Rua X, 100", cnpjCpf: "11.222.333/0001-44", inscricaoEstadual: "ISENTO",
    inscricaoMunicipal: "123456",
    representante: { nome: "Fulano", cargo: "Diretor", telefones: "(31) 99999-0000", email: "f@acme.com" },
  },
  projeto: {
    ...projetoInfoVazio(),
    titulo: "Convenção 2026", modalidade: "Cultural", local: "Teatro Sesiminas",
    enderecoLocal: "Av. Afonso Pena, 1000", evento: "2026-09-10", horario: "20h",
    participantes: 300, produtoraResponsavel: "Marisa", telefoneProdutora: "(31) 98888-0000",
    emailProdutora: "marisa@polobh.com.br",
    cronograma: {
      montagem: [{ id: "f1", data: "2026-09-08", inicio: "08:00", fim: "18:00" }],
      alinhamentos: [], ensaios: [], evento: [{ id: "f2", data: "2026-09-10", inicio: "20:00", fim: "23:00" }],
      desmontagem: [],
    },
  },
  linhas, producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "Marisa", validadeDias: 30, criadoEm: "2026-08-01", atualizadoEm: "2026-08-01", ativa: true,
});

const os = (ecLinhaIds: string[]): Os => ({
  id: "os1", numero: "EC – ACME – Convenção – OS-01", slugCredenciamento: "abc", seq: 1,
  ecId: "ec1", ecNumero: "EC – ACME – V01", ecLinhaIds, status: "Emitida",
  fornecedor: {
    id: "f1", razaoSocial: "Som & Luz LTDA", nomeFantasia: "Som & Luz", cnpj: "12.345.678/0001-95",
    perfilTributario: "Simples Nacional", endereco: "Rua Y, 20", inscricaoEstadual: "ISENTO",
    inscricaoMunicipal: "9988",
    dadosBancarios: { tipoConta: "PJ", banco: "Itaú", agencia: "1234", conta: "56789-0", chavePix: "12345678000195" },
    representante: "Beltrano", telefone: "(31) 97777-0000", email: "contato@somluz.com.br",
  },
  modalidade: "Serviço", descritivo: "Sonorização completa", entrega: "Instalação e operação",
  cronograma: [{ etapa: "Montagem", data: "2026-09-08", horario: "08:00", atividades: "Rigging e som" }],
  logistica: {
    transporteMaterial: "Caminhão próprio", transporteEquipe: "Van", hospedagem: "Não se aplica",
    alimentacao: "Por conta do fornecedor", estacionamentoCarga: "Doca 2", estacionamentoEquipe: "Térreo",
    uniformizacao: "Camiseta preta",
  },
  infraestrutura: {
    energia: "220V trifásico", internet: "Wi-Fi do local", pontosEletricos: "8 pontos",
    estruturas: "Praticável 2x1", servicosApoio: "Carregadores", artLaudos: "ART emitida",
  },
  observacoes: [],
  credenciamento: { prazoLimite: "2026-09-01", linkFormulario: "https://forms.polobh.com.br/cred/abc" }, // link legado, fictício
  orcamento: {
    valorEc: 10000, valorComBvNf: 9000, valorSemBvComNf: 8500, valorSemBvSemNf: 8000,
    parcelas: [{ descricao: "Entrada", valor: 5000 }, { descricao: "Saldo", valor: 5000 }],
    documentoFiscal: "Nota Fiscal",
  },
  financeiro: {
    tomador: "Cliente", descritivoNf: "Sonorização", cnae: "9001-9/06", codigoServico: "17.02",
    valorUnitario: 10000, valorTotal: 10000, descontoNegociado: 500, valorAPagar: 9500,
    bvPercentual: 15, bvValor: 1500, bvJustificativa: "", acertoFinanceiro: "Depósito em 30 dias",
  },
  contrato: {
    contratante: "Cliente", descritivoServicos: "Sonorização", informacoesComplementares: "",
    valorUnitario: 10000, valorTotal: 10000, descontoNegociado: 500, valorAPagar: 9500,
    dataContrato: "2026-08-20", rubrica: "MC",
  },
  criadoEm: "2026-08-20", atualizadoEm: "2026-08-20",
});

async function abrir(o: Os, e: Ec) {
  const { buffer, nome } = await criarOsExcelBuffer(o, e);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("OS")!;
  /** Texto de toda a planilha, linha a linha — o jeito mais direto de conferir conteúdo. */
  const linhas: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    const partes: string[] = [];
    row.eachCell({ includeEmpty: false }, (c) => {
      const v = c.value;
      const t = v && typeof v === "object" && "formula" in v ? `=${v.formula}` : v;
      if (t !== null && t !== undefined && t !== "") partes.push(String(t));
    });
    linhas[i] = partes.join(" | ");
  });
  return { ws, wb, nome, linhas, texto: linhas.join("\n") };
}

describe("Excel da OS — modelo novo", () => {
  it("puxa do sistema tudo o que o modelo manda vir da EC e do projeto", async () => {
    const { texto } = await abrir(os(["l1"]), ec([linha({ id: "l1", item: "Som", valorPolobh: 10000 })]));
    // Cliente
    expect(texto).toContain("ACME Eventos LTDA");
    expect(texto).toContain("11.222.333/0001-44");
    // Projeto (inclusive modalidade e cronograma, que antes não saíam)
    expect(texto).toContain("Convenção 2026");
    expect(texto).toContain("Teatro Sesiminas");
    expect(texto).toContain("Av. Afonso Pena, 1000");
    expect(texto).toContain("Marisa");
    expect(texto).toContain("Cultural");
    expect(texto).toContain("Montagem");
    expect(texto).toContain("08:00 às 18:00");
    // Fornecedor e contratação
    expect(texto).toContain("Som & Luz");
    expect(texto).toContain("Simples Nacional");
    expect(texto).toContain("Itaú");
    expect(texto).toContain("220V trifásico");
    expect(texto).toContain("Camiseta preta");
    // Credenciamento: o link sai do token gerado pelo banco, nunca do domínio
    // fictício que a OS carregava por padrão (forms.polobh.com.br).
    expect(texto).toContain("/credenciamento/abc");
    expect(texto).not.toContain("forms.polobh.com.br");
  });

  it("não exporta a coluna de OBSERVAÇÕES do modelo (era só o guia de preenchimento)", async () => {
    const { ws, texto } = await abrir(os(["l1"]), ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).not.toContain("Informação vem automaticamente da EC");
    expect(texto).not.toContain("Informação Preenchida pela equipe");
    // A planilha termina na coluna O — a P do modelo não existe aqui.
    expect(ws.columnCount).toBeLessThanOrEqual(15);
  });

  it("o ORÇAMENTO sai item a item, com a opção escolhida logo abaixo do valor da EC", async () => {
    const linhas = [
      linha({ id: "l1", item: "Som", valorPolobh: 10000, valorComBvNf: 9000, opcaoValor: "comBvNf" }),
      linha({ id: "l2", item: "Luz", valorPolobh: 4000, valorSemBvSemNf: 3600, opcaoValor: "semBvSemNf" }),
    ];
    const { linhas: linhasTxt } = await abrir(os(["l1", "l2"]), ec(linhas));
    const i = linhasTxt.findIndex((l) => l?.startsWith("ORÇAMENTO"));
    expect(i).toBeGreaterThan(0);
    // Bloco do primeiro item: nome, valor na EC e a opção marcada.
    expect(linhasTxt[i + 1]).toContain("Som");
    expect(linhasTxt[i + 2]).toContain("Valor do Item na EC do Projeto");
    expect(linhasTxt[i + 2]).toContain("10000");
    expect(linhasTxt[i + 3]).toContain("Valor com BV e NF");
    expect(linhasTxt[i + 3]).toContain("9000");
    // ...e o do segundo, na sequência.
    expect(linhasTxt[i + 4]).toContain("Luz");
    expect(linhasTxt[i + 5]).toContain("4000");
    expect(linhasTxt[i + 6]).toContain("Valor Sem BV e Sem NF");
    expect(linhasTxt[i + 6]).toContain("3600");
    // As opções não escolhidas não entram — é a decisão da produção que sai.
    expect(linhasTxt[i + 3]).not.toContain("Sem BV");
  });

  it("item sem opção escolhida diz isso, em vez de inventar uma forma de cobrança", async () => {
    const { texto } = await abrir(os(["l1"]), ec([linha({ id: "l1", item: "Som", valorPolobh: 10000 })]));
    expect(texto).toContain("A produção ainda não escolheu a forma de cobrança deste item.");
  });

  it("mantém as fórmulas vivas do bloco financeiro apontando para as células certas", async () => {
    const { ws } = await abrir(os(["l1"]), ec([linha({ id: "l1", valorPolobh: 10000 })]));
    const formulas: string[] = [];
    ws.eachRow((row) =>
      row.eachCell((c) => {
        const v = c.value;
        if (v && typeof v === "object" && "formula" in v) formulas.push(`${c.address}:${v.formula}`);
      })
    );
    // Nas linhas de valor o número vive na faixa da direita (M): as fórmulas
    // precisam apontar para lá, senão somam o rótulo em vez do valor.
    expect(formulas.length).toBeGreaterThan(0);
    // (células mescladas repetem a fórmula do mestre — só a referência importa aqui)
    const referencias = formulas.map((f) => f.split(":")[1]);
    expect(referencias.every((f) => /^M\d+([-*]M\d+)+(\/100)?$/.test(f))).toBe(true);
    expect(referencias.some((f) => f.includes("/100"))).toBe(true); // o BV continua vivo
  });

  it("sem acesso ao financeiro, os blocos restritos não saem na planilha", async () => {
    const { buffer } = await criarOsExcelBuffer(os(["l1"]), ec([linha({ id: "l1", valorPolobh: 1000 })]), {
      incluirFinanceiro: false,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    let texto = "";
    wb.getWorksheet("OS")!.eachRow((row) => row.eachCell((c) => (texto += ` ${c.value ?? ""}`)));
    expect(texto).not.toContain("DADOS PARA CONTRATO");
    expect(texto).not.toContain("BV Pólobh");
    // ...mas o que o fornecedor precisa ler continua lá.
    expect(texto).toContain("DETALHAMENTO DA CONTRATAÇÃO");
    expect(texto).toContain("CREDENCIAMENTO");
  });
});
