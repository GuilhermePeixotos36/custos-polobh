import { describe, expect, it } from "vitest";
import { montarSugestoes } from "./sugestoes";
import { projetoInfoVazio } from "./projeto";
import { honorariosPadrao, encargosPadrao, producaoZerada } from "./calc";
import type { Cliente, Ec, EcLinha, Os, Projeto } from "@/data/types";

const cliente = (representante = ""): Cliente => ({
  id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: representante, cargo: "", telefones: "", email: "" },
});

const projeto = (local: string, representante = ""): Projeto => ({
  id: `p-${local}`, nome: local, cliente: cliente(representante),
  info: { ...projetoInfoVazio(), local, enderecoLocal: `Rua ${local}` },
  docsUrl: "", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

const linha = (p: Partial<EcLinha>): EcLinha => ({
  id: "l", grupo: "PRODUÇÃO", item: "", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0, statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
  codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const ec = (linhas: EcLinha[], local = ""): Ec => ({
  id: "ec", numero: "EC", slugPublico: "", versao: 1, status: "Rascunho", projetoId: "p",
  template: "", clienteId: "c1", cliente: cliente(),
  projeto: { ...projetoInfoVazio(), local }, linhas,
  producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "", validadeDias: 30, criadoEm: "", atualizadoEm: "", ativa: true,
});

const os = (p: Partial<Os["logistica"]>): Os => ({
  id: "os", numero: "OS-01", slugCredenciamento: "", seq: 1, ecId: "ec", ecNumero: "EC",
  ecLinhaIds: [], status: "Rascunho",
  fornecedor: {
    id: "", razaoSocial: "", nomeFantasia: "", cnpj: "", perfilTributario: "", endereco: "",
    inscricaoEstadual: "", inscricaoMunicipal: "",
    dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: "", telefone: "", email: "",
  },
  modalidade: "", descritivo: "", entrega: "Instalação e operação", cronograma: [],
  logistica: {
    transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "",
    estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "", ...p,
  },
  infraestrutura: { energia: "220V trifásico", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
  observacoes: [],
  credenciamento: { prazoLimite: "", linkFormulario: "" },
  orcamento: { valorEc: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, parcelas: [], documentoFiscal: "" },
  financeiro: {
    tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: 0, valorTotal: 0,
    descontoNegociado: 0, valorAPagar: 0, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "",
  },
  contrato: {
    contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: 0,
    valorTotal: 0, descontoNegociado: 0, valorAPagar: 0, dataContrato: "", rubrica: "",
  },
  criadoEm: "", atualizadoEm: "",
});

describe("montarSugestoes", () => {
  it("junta o que já foi escrito em projetos, ECs e OSs", () => {
    const s = montarSugestoes(
      [projeto("Teatro Sesiminas", "João Andrade")],
      [ec([linha({ item: "Buffet", codigoServico: "17.02", pedidoCompra: "PC-100" })])],
      [os({ hospedagem: "Hotel Ouro Minas" })]
    );
    expect(s.local).toContain("Teatro Sesiminas");
    expect(s.enderecoLocal).toContain("Rua Teatro Sesiminas");
    expect(s.representante).toContain("João Andrade");
    expect(s.itemEc).toContain("Buffet");
    expect(s.codigoServico).toContain("17.02");
    expect(s.pedidoCompra).toContain("PC-100");
    expect(s.hospedagem).toContain("Hotel Ouro Minas");
    expect(s.entrega).toContain("Instalação e operação");
    expect(s.energia).toContain("220V trifásico");
  });

  it("o mais usado vem primeiro — repetição é sinal do valor certo da casa", () => {
    const s = montarSugestoes(
      [projeto("Expominas"), projeto("Expominas"), projeto("Minascentro")],
      [], []
    );
    expect(s.local[0]).toBe("Expominas");
  });

  it("mesma grafia com outra caixa/acento conta junto, e vale a primeira vista", () => {
    const s = montarSugestoes([projeto("Expominas"), projeto("EXPOMINAS")], [], []);
    expect(s.local).toEqual(["Expominas"]);
  });

  it("ignora vazio e texto longo demais para ser um valor repetível", () => {
    const s = montarSugestoes([projeto(""), projeto("x".repeat(200))], [], []);
    expect(s.local).toEqual([]);
  });
});
