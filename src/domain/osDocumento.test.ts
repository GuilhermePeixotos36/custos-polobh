import { describe, expect, it } from "vitest";
import { montarOsDocumento, type BlocoOs } from "./osDocumento";
import { bvVazio } from "./calc";
import { itemDaLinhaEc, valorDaContratacao } from "./contratacaoOs";
import type { Ec, EcLinha, Os } from "@/data/types";

const linha = {
  id: "l1", grupo: "SOM", item: "Sonorização", descricao: "Som do evento", descricaoCompleta: "",
  valorPolobh: 1500, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 1000, valorSemBvSemNf: 0,
  valoresNaoAplicaveis: [], bv: bvVazio(),
  statusAprovacao: "OK", fornecedorRazao: "Som Teste Ltda", fornecedorCnpj: "", fornecedorContato: "",
  faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "OK", contratoStatus: "Pendente",
  observacao: "", observacoes: [], oculto: false, ordem: 0,
} as unknown as EcLinha;

const ec = { id: "ec1", linhas: [linha] } as unknown as Ec;

const osCom = (fin: Partial<Os["financeiro"]>, banco: Partial<Os["fornecedor"]["dadosBancarios"]> = {}): Os => {
  const itens = [{ ...itemDaLinhaEc(linha), forma: "semBvComNf" as const }];
  const valor = valorDaContratacao(itens);
  return {
    id: "os1", numero: "BM – Convenção 2027 – Sonorização – Som Teste – (Som Teste Ltda) – OS (01) em 27 11 26",
    status: "Ativa", fase: "backoffice", criadoEm: "2026-11-27T10:00:00.000Z", ecLinhaIds: ["l1"], itens,
    modalidade: "Serviço", descritivo: "Som do evento",
    cliente: { nome: "Banco Mercantil", razaoSocial: "", endereco: "", cnpjCpf: "", inscricaoEstadual: "", inscricaoMunicipal: "" },
    projeto: { titulo: "BM – Convenção 2027", modalidade: "Corporativo", cronograma: {}, etapasOcultas: [] },
    fornecedor: {
      razaoSocial: "Som Teste Ltda", nomeFantasia: "Som Teste", cnpj: "", perfilTributario: "", endereco: "",
      inscricaoEstadual: "", inscricaoMunicipal: "", representante: "", telefone: "", email: "",
      dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "", ...banco },
    },
    logistica: {}, infraestrutura: {}, cronograma: [], cronogramaNaoSeAplica: true,
    orcamento: { valorEc: 1500, valorComBvNf: valor, valorSemBvComNf: valor, valorSemBvSemNf: valor, parcelas: [], documentoFiscal: "Nota Fiscal", valorContratado: valor },
    financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valor, valorTotal: valor, descontoNegociado: 0, valorAPagar: valor, ...fin },
    contrato: {},
  } as unknown as Os;
};

const valorDe = (blocos: BlocoOs[], label: string) =>
  blocos.filter((b): b is Extract<BlocoOs, { t: "lv" }> => b.t === "lv" && b.label === label).map((b) => b.valor);

describe("a forma de pagamento no documento da OS (PDF)", () => {
  it("sai a opção escolhida no faturamento", () => {
    for (const meio of ["Dados bancários", "Cartão de crédito", "Boleto bancário"] as const) {
      const { blocos } = montarOsDocumento(osCom({ meioPagamento: meio }), ec, { restrito: true });
      expect(valorDe(blocos, "Forma de Pagamento")).toEqual([meio]);
    }
  });

  it("com Dados bancários, a conta sai junto; com cartão ou boleto, não", () => {
    const banco = { tipoConta: "PJ" as const, banco: "Itaú", agencia: "1234", conta: "5678-9", chavePix: "x@y.com" };
    const comConta = montarOsDocumento(osCom({ meioPagamento: "Dados bancários" }, banco), ec, { restrito: true }).blocos;
    expect(valorDe(comConta, "Dados Bancários")[0]).toBe("Tipo de conta: PJ\nBanco: Itaú\nAgência: 1234\nConta corrente: 5678-9\nChave Pix: x@y.com");
    const boleto = montarOsDocumento(osCom({ meioPagamento: "Boleto bancário" }, banco), ec, { restrito: true }).blocos;
    expect(valorDe(boleto, "Dados Bancários")).toEqual([]);
  });

  it("o texto antigo de forma de pagamento não aparece mais como forma: virou prazo", () => {
    const { blocos } = montarOsDocumento(osCom({ formaPagamento: "À vista, na emissão da nota" }), ec, { restrito: true });
    expect(valorDe(blocos, "Forma de Pagamento")).toEqual([""]);
    expect(valorDe(blocos, "Prazo de Pagamento")).toEqual(["À vista, na emissão da nota"]);
  });

  it("documento fiscal e prazo saem no faturamento; o Resumo dos Custos não existe mais", () => {
    const { blocos } = montarOsDocumento(osCom({ meioPagamento: "Boleto bancário", prazoPagamento: "30 dias" }), ec, { restrito: true });
    expect(valorDe(blocos, "Documento Fiscal")).toEqual(["Nota Fiscal"]);
    expect(valorDe(blocos, "Prazo de Pagamento")).toEqual(["30 dias"]);
    expect(blocos.some((b) => b.t === "secao" && b.titulo === "Resumo dos Custos")).toBe(false);
  });

  it("sem o bloco de faturamento (quem não vê o financeiro), a forma não sai", () => {
    const { blocos } = montarOsDocumento(osCom({ meioPagamento: "Boleto bancário" }), ec, { restrito: false });
    expect(valorDe(blocos, "Forma de Pagamento")).toEqual([]);
  });
});
