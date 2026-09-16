import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { criarOsExcelBuffer } from "./os";
import { honorariosPadrao, encargosPadrao, producaoZerada,
  bvVazio,
} from "@/domain/calc";
import { projetoInfoVazio } from "@/domain/projeto";
import type { Cliente, Ec, EcLinha, Os, ProjetoInfo } from "@/data/types";

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
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], bv: bvVazio(),
  statusAprovacao: "OK", fornecedorRazao: "Som & Luz LTDA", fornecedorCnpj: "12.345.678/0001-95",
  fornecedorContato: "", faturaNf: "Nota Fiscal", codigoServico: "17.02", pedidoCompra: "PC-1",
  statusOs: "OK", contratoStatus: "OK", observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

/** Cliente e dados do evento — a EC os guarda, e a OS guarda a sua própria foto deles. */
const clienteFixture = (): Cliente => ({
  id: "c1", apelido: "ACME", nome: "ACME Eventos", razaoSocial: "ACME Eventos LTDA",
  endereco: "Rua X, 100", cnpjCpf: "11.222.333/0001-44", inscricaoEstadual: "ISENTO",
  inscricaoMunicipal: "123456",
  representante: { nome: "Fulano", cargo: "Diretor", telefones: "(31) 99999-0000", email: "f@acme.com" },
});

const projetoFixture = (): ProjetoInfo => ({
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
});

const ec = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "", versao: 1, status: "Aprovada",
  projetoId: "p1", template: "Cultural", clienteId: "c1",
  cliente: clienteFixture(),
  projeto: projetoFixture(),
  observacoes: [],
  linhas, producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "Marisa", validadeDias: 30, criadoEm: "2026-08-01", atualizadoEm: "2026-08-01", ativa: true,
});

const os = (ecLinhaIds: string[]): Os => ({
itens: [],
  id: "os1", numero: "EC – ACME – Convenção – OS-01", slugCredenciamento: "abc", seq: 1,
  ecId: "ec1", ecNumero: "EC – ACME – V01", ecLinhaIds, status: "Emitida",
  projeto: projetoFixture(),
  cliente: clienteFixture(),
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
    transporteMaterial: "Caminhão próprio", transporteEquipe: "Van", hospedagem: "Hotel Ouro Minas",
    alimentacao: "Por conta do fornecedor", estacionamentoCarga: "Doca 2", estacionamentoEquipe: "Térreo",
    uniformizacao: "Camiseta preta",
  },
  infraestrutura: {
    energia: "220V trifásico", internet: "Wi-Fi do local", pontosEletricos: "8 pontos",
    estruturas: "Praticável 2x1", servicosApoio: "Carregadores", artLaudos: "ART emitida",
  },
  observacoesGerais: "",
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
    // O credenciamento saiu da OS (virou subaba do Projeto): nem o link nem o
    // prazo aparecem mais na planilha que o fornecedor recebe.
    expect(texto).not.toContain("CREDENCIAMENTO");
    expect(texto).not.toContain("/credenciamento/abc");
    expect(texto).not.toContain("forms.polobh.com.br");
  });

  it("item de logística marcado como 'não se aplica' não vira linha na planilha", async () => {
    const semHospedagem = os(["l1"]);
    semHospedagem.logistica = { ...semHospedagem.logistica, naoAplicaveis: ["hospedagem", "estacionamentoCarga"] };
    const { texto } = await abrir(semHospedagem, ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).not.toContain("Hospedagem Equipe");
    expect(texto).not.toContain("Hotel Ouro Minas");
    expect(texto).not.toContain("Estacionamento Carga");
    expect(texto).not.toContain("Doca 2");
    // O que continua valendo segue saindo, com rótulo e valor.
    expect(texto).toContain("Transporte Material");
    expect(texto).toContain("Caminhão próprio");
  });

  it("com nada aplicável, a seção de logística some inteira", async () => {
    const semLogistica = os(["l1"]);
    semLogistica.logistica = {
      ...semLogistica.logistica,
      naoAplicaveis: ["transporteMaterial", "transporteEquipe", "hospedagem", "alimentacao",
        "estacionamentoCarga", "estacionamentoEquipe", "uniformizacao"],
    };
    const { texto } = await abrir(semLogistica, ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).not.toContain("Logística do Fornecedor");
    // A seção seguinte continua no lugar — some a logística, não o resto.
    expect(texto).toContain("Infraestrutura");
    expect(texto).toContain("220V trifásico");
  });

  it("infraestrutura marcada como 'não se aplica' também some da planilha", async () => {
    const semInternet = os(["l1"]);
    semInternet.infraestrutura = { ...semInternet.infraestrutura, naoAplicaveis: ["internet", "artLaudos"] };
    const { texto } = await abrir(semInternet, ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).not.toContain("Wi-Fi do local");
    expect(texto).not.toContain("ART, Laudos e Certificações");
    expect(texto).toContain("220V trifásico");
  });

  it("não exporta a coluna de OBSERVAÇÕES do modelo (era só o guia de preenchimento)", async () => {
    const { ws, texto } = await abrir(os(["l1"]), ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).not.toContain("Informação vem automaticamente da EC");
    expect(texto).not.toContain("Informação Preenchida pela equipe");
    // A planilha termina na coluna O — a P do modelo não existe aqui.
    expect(ws.columnCount).toBeLessThanOrEqual(15);
  });

  it("o RESUMO DOS CUSTOS sai como tabela: o item e as três formas, lado a lado", async () => {
    const linhas = [
      linha({ id: "l1", item: "Som", valorPolobh: 10000, valorComBvNf: 9000, valorSemBvComNf: 8500, valorSemBvSemNf: 8000 }),
      linha({ id: "l2", item: "Luz", valorPolobh: 4000, valorComBvNf: 4000, valorSemBvComNf: 3800, valorSemBvSemNf: 3600 }),
    ];
    const { linhas: linhasTxt } = await abrir(os(["l1", "l2"]), ec(linhas));
    const i = linhasTxt.findIndex((l) => l?.startsWith("RESUMO DOS CUSTOS"));
    expect(i).toBeGreaterThan(0);
    // Cabeçalho da tabela, depois um item por linha com as três formas.
    expect(linhasTxt[i + 1]).toContain("VALOR COM BV E NF");
    expect(linhasTxt[i + 1]).toContain("VALOR SEM BV E SEM NF");
    expect(linhasTxt[i + 2]).toContain("Som");
    expect(linhasTxt[i + 2]).toContain("9.000,00");
    expect(linhasTxt[i + 2]).toContain("8.500,00");
    expect(linhasTxt[i + 2]).toContain("8.000,00");
    expect(linhasTxt[i + 3]).toContain("Luz");
  });

  it("fecha com o total de cada coluna — cada uma é um cenário inteiro", async () => {
    const linhas = [
      linha({ id: "l1", item: "Som", valorComBvNf: 9000, valorSemBvComNf: 8500, valorSemBvSemNf: 8000 }),
      linha({ id: "l2", item: "Luz", valorComBvNf: 4000, valorSemBvComNf: 3800, valorSemBvSemNf: 3600 }),
    ];
    const { linhas: linhasTxt, texto } = await abrir(os(["l1", "l2"]), ec(linhas));
    const total = linhasTxt.find((l) => l?.includes("TOTAL POR FORMA DE COBRANÇA"))!;
    expect(total).toContain("13.000,00"); // com BV e NF
    expect(total).toContain("12.300,00"); // sem BV, com NF
    expect(total).toContain("11.600,00"); // sem BV, sem NF
    // E o que vira nota fiscal são só as duas colunas COM nota.
    expect(texto).toContain("Total a Faturar");
    expect(texto).toContain("25300"); // 13.000 + 12.300
  });

  it("forma que não se aplica a item nenhum não vira coluna", async () => {
    // Revisão de 09/09/2026: só vão ao fornecedor as colunas com algum valor.
    // Uma coluna inteira "não se aplica" não é informação numa tabela que ele
    // confere linha a linha — ela simplesmente não sai.
    const l = linha({
      id: "l1", item: "Praticáveis", valorPolobh: 10000,
      valorComBvNf: 9000, valorSemBvComNf: 8500, valoresNaoAplicaveis: ["comBvNf"],
    });
    const { linhas: linhasTxt, texto } = await abrir(os(["l1"]), ec([l]));
    const cabecalho = linhasTxt.find((x) => x?.includes("ITEM"))!;
    expect(cabecalho).toContain("VALOR SEM BV E COM NF");
    expect(cabecalho).not.toContain("VALOR COM BV E NF");
    // O 9000 continua guardado na EC, mas não pode aparecer como se fosse cobrança.
    expect(texto).not.toContain("9.000,00");
    expect(linhasTxt.find((x) => x?.includes("Praticáveis"))).toContain("8.500,00");
  });

  it("na coluna que sai, o item que não se aplica sai escrito, e não como zero", async () => {
    // Célula vazia seria lida como R$ 0,00 — "não se aplica" é resposta da
    // produção, e o fornecedor precisa ler a diferença.
    const { linhas: linhasTxt } = await abrir(
      os(["l1", "l2"]),
      ec([
        linha({ id: "l1", item: "Praticáveis", valorComBvNf: 9000 }),
        linha({ id: "l2", item: "Buffet", valorComBvNf: 4000, valoresNaoAplicaveis: ["comBvNf"] }),
      ])
    );
    expect(linhasTxt.find((x) => x?.includes("Buffet"))).toContain("Não se aplica");
    expect(linhasTxt.find((x) => x?.includes("Praticáveis"))).toContain("9.000,00");
  });

  it("os dados para pagamento vão no fim, junto do que se fatura", async () => {
    const { texto } = await abrir(os(["l1"]), ec([linha({ id: "l1", valorComBvNf: 1000 })]));
    expect(texto).toContain("Dados para Pagamento");
    expect(texto).toContain("Itaú");
    expect(texto).toContain("Ag. 1234");
    expect(texto).toContain("Prazo de Pagamento");
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
    // A fórmula do BV saiu junto com o bloco dele (15/09/2026): o BV é combinado
    // item a item, no Detalhamento, e o acerto que ficou aqui é outra conta —
    // calculada no domínio e gravada como número (ver `calcularAcerto`).
  });

  it("o bloco de emissão termina nos códigos, e o acerto fica no fim", async () => {
    const { linhas } = await abrir(os(["l1"]), ec([linha({ id: "l1", valorPolobh: 10000 })]));
    const onde = (t: string) => linhas.findIndex((l) => l?.includes(t));

    const pagar = onde("Valor total a pagar");
    const acertos = onde("ACERTOS FINANCEIROS");
    const contrato = onde("DADOS PARA CONTRATO");
    expect(pagar).toBeGreaterThan(0);

    // Os valores sobem e os dois códigos descem (15/09/2026): é pelos valores
    // que se confere a nota, e o código de serviço é o último dado a se saber.
    expect(onde("Código de Serviço")).toBeGreaterThan(pagar);
    expect(onde("Ordem de Compra")).toBeGreaterThan(pagar);
    // O contrato vem depois do bloco de emissão, e o acerto fecha a OS.
    expect(contrato).toBeGreaterThan(pagar);
    expect(acertos).toBeGreaterThan(contrato);
    expect(onde("Observações:")).toBeGreaterThan(acertos);
    expect(linhas.slice(acertos).join("\n")).toContain("Depósito em 30 dias");
  });

  it("lei de incentivo sai em UMA linha, com o número dentro", async () => {
    const comLei = os(["l1"]);
    comLei.financeiro = {
      ...comLei.financeiro,
      leiIncentivo: "Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234",
    };
    const { texto } = await abrir(comLei, ec([linha({ id: "l1", valorPolobh: 1000 })]));
    expect(texto).toContain("Lei de Incentivo à Cultura: Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234");
    // O campo separado deixou de existir: nem rótulo vazio sobra na planilha.
    expect(texto).not.toContain("Nº Projeto Incentivado");
  });

  it("item com contrato 'Não se Aplica' na EC tira o bloco de contrato da planilha", async () => {
    const semContrato = os(["l1"]);
    // Contrato que ninguém escreveu: só o que o sistema preenche sozinho.
    semContrato.contrato = { ...semContrato.contrato, rubrica: "", informacoesComplementares: "" };
    const { texto } = await abrir(
      semContrato,
      ec([linha({ id: "l1", valorPolobh: 10000, contratoStatus: "Não se Aplica" })])
    );
    expect(texto).not.toContain("DADOS PARA CONTRATO");
    expect(texto).not.toContain("Data do Contrato");
    expect(texto).not.toContain("O objeto do presente");
    // A emissão da nota e os acertos continuam saindo — some o contrato, não o resto.
    expect(texto).toContain("Valor total a pagar");
    expect(texto).toContain("ACERTOS FINANCEIROS");
  });

  it("basta um item pedindo contrato para o bloco voltar", async () => {
    const misto = os(["l1", "l2"]);
    misto.contrato = { ...misto.contrato, rubrica: "", informacoesComplementares: "" };
    const { texto } = await abrir(
      misto,
      ec([
        linha({ id: "l1", valorPolobh: 10000, contratoStatus: "Não se Aplica" }),
        linha({ id: "l2", valorPolobh: 2000, contratoStatus: "Emitir" }),
      ])
    );
    expect(texto).toContain("DADOS PARA CONTRATO");
  });

  it("contrato já escrito pela equipe não some da planilha se o status mudar depois", async () => {
    // A OS de teste tem rubrica "MC" — alguém escreveu este contrato.
    const { texto } = await abrir(
      os(["l1"]),
      ec([linha({ id: "l1", valorPolobh: 10000, contratoStatus: "Não se Aplica" })])
    );
    expect(texto).toContain("DADOS PARA CONTRATO");
    expect(texto).toContain("Rubrica");
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
    expect(texto).toContain("RESUMO DOS CUSTOS");
  });
});
