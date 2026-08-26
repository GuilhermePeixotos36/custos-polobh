import { describe, expect, it } from "vitest";
import { filhosDe, montarSugestoes } from "./sugestoes";
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
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, opcaoValor: "",
  statusAprovacao: "Pendente",
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
    expect(s.valores.local).toContain("Teatro Sesiminas");
    expect(s.valores.enderecoLocal).toContain("Rua Teatro Sesiminas");
    expect(s.valores.representante).toContain("João Andrade");
    expect(s.valores.itemEc).toContain("Buffet");
    expect(s.valores.codigoServico).toContain("17.02");
    expect(s.valores.pedidoCompra).toContain("PC-100");
    expect(s.valores.hospedagem).toContain("Hotel Ouro Minas");
    expect(s.valores.entrega).toContain("Instalação e operação");
    expect(s.valores.energia).toContain("220V trifásico");
  });

  it("o mais usado vem primeiro — repetição é sinal do valor certo da casa", () => {
    const s = montarSugestoes(
      [projeto("Expominas"), projeto("Expominas"), projeto("Minascentro")],
      [], []
    );
    expect(s.valores.local[0]).toBe("Expominas");
  });

  it("mesma grafia com outra caixa/acento conta junto, e vale a primeira vista", () => {
    const s = montarSugestoes([projeto("Expominas"), projeto("EXPOMINAS")], [], []);
    expect(s.valores.local).toEqual(["Expominas"]);
  });

  it("ignora vazio e texto longo demais para ser um valor repetível", () => {
    const s = montarSugestoes([projeto(""), projeto("x".repeat(200))], [], []);
    expect(s.valores.local).toEqual([]);
  });
});

describe("vínculos entre campos que andam juntos", () => {
  /** Projeto com produtora responsável e contato dela — o par pai/filho da tela. */
  const comProdutora = (nome: string, telefone: string, email: string): Projeto => ({
    ...projeto("Expominas"),
    id: `p-${nome}-${telefone}`,
    info: { ...projetoInfoVazio(), produtoraResponsavel: nome, telefoneProdutora: telefone, emailProdutora: email },
  });

  it("escolher o local traz o endereço que já foi usado com ele", () => {
    const s = montarSugestoes([projeto("Teatro Sesiminas")], [], []);
    expect(filhosDe(s, "local", "Teatro Sesiminas")).toEqual({ enderecoLocal: "Rua Teatro Sesiminas" });
  });

  it("acha o vínculo mesmo com outra caixa ou acento no pai", () => {
    const s = montarSugestoes([projeto("Teatro Sesiminas")], [], []);
    expect(filhosDe(s, "local", "teatro sesiminas").enderecoLocal).toBe("Rua Teatro Sesiminas");
  });

  it("a produtora responsável traz telefone e e-mail juntos", () => {
    const s = montarSugestoes([comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br")], [], []);
    expect(filhosDe(s, "produtoraResponsavel", "Marisa")).toEqual({
      telefoneProdutora: "(31) 98888-0000",
      emailProdutora: "marisa@polobh.com.br",
    });
  });

  it("quando o histórico diverge, vence o que apareceu mais vezes", () => {
    const s = montarSugestoes(
      [
        comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br"),
        comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br"),
        comProdutora("Marisa", "(31) 90000-1111", "antigo@polobh.com.br"),
      ],
      [], []
    );
    expect(filhosDe(s, "produtoraResponsavel", "Marisa").telefoneProdutora).toBe("(31) 98888-0000");
  });

  it("valor que a casa nunca usou não inventa filho nenhum", () => {
    const s = montarSugestoes([projeto("Expominas")], [], []);
    expect(filhosDe(s, "local", "Casa Nova")).toEqual({});
    expect(filhosDe(s, "local", "")).toEqual({});
  });

  it("as ECs também alimentam o vínculo — elas guardam projetos fora da lista", () => {
    const daEc = ec([], "Minascentro");
    daEc.projeto.enderecoLocal = "Av. Augusto de Lima, 785";
    const s = montarSugestoes([], [daEc], []);
    expect(filhosDe(s, "local", "Minascentro").enderecoLocal).toBe("Av. Augusto de Lima, 785");
  });
});
