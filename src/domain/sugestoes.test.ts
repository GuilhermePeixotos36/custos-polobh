import { describe, expect, it } from "vitest";
import { filhosDe, montarSugestoes, paresConsistentes, type BaseSugestoes } from "./sugestoes";
import { projetoInfoVazio } from "./projeto";
import { honorariosPadrao, encargosPadrao, producaoZerada,
  bvVazio,
} from "./calc";
import type { Checklist, Cliente, Ec, EcLinha, ItemChecklist, Os, Projeto } from "@/data/types";

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
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], opcaoValor: "", bv: bvVazio(),
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
  projeto: projetoInfoVazio(),
  cliente: cliente(),
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
  observacoesGerais: "",
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

/** Atalho dos testes: a base tem quatro listas e quase nenhum caso usa as quatro. */
const base = (projetos: Projeto[], ecs: Ec[], oss: Os[], checklists: Checklist[] = []): BaseSugestoes =>
  ({ projetos, ecs, oss, checklists });

const tarefa = (p: Partial<ItemChecklist>): ItemChecklist => ({
  id: "i1", checklistId: "cl1", origemModeloItemId: "", titulo: "", descricao: "", etapa: "",
  status: "Pendente", dataLimite: "", dataManual: false, concluidoEm: "", concluidoPor: "",
  responsavel: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const checklist = (itens: ItemChecklist[]): Checklist => ({
  id: "cl1", projetoId: "p1", modalidade: "Corporativo", modeloId: "m1", itens,
  criadoEm: "", atualizadoEm: "",
});

describe("montarSugestoes", () => {
  it("junta o que já foi escrito em projetos, ECs e OSs", () => {
    const s = montarSugestoes(base([projeto("Teatro Sesiminas", "João Andrade")], [ec([linha({ item: "Buffet", codigoServico: "17.02", pedidoCompra: "PC-100" })])], [os({ hospedagem: "Hotel Ouro Minas" })]));
    expect(s.valores.local).toContain("Teatro Sesiminas");
    expect(s.valores.enderecoLocal).toContain("Rua Teatro Sesiminas");
    expect(s.valores.representante).toContain("João Andrade");
    expect(s.valores.itemEc).toContain("Buffet");
    expect(s.valores.codigoServico).toContain("17.02");
    expect(s.valores.pedidoCompra).toContain("PC-100");
    expect(s.valores.hospedagem).toContain("Hotel Ouro Minas");
    expect(s.valores.energia).toContain("220V trifásico");
  });

  it("\"Entrega\" fica de fora: é específica de cada contratação", () => {
    // A OS de exemplo tem entrega preenchida; ainda assim o campo não existe no
    // catálogo, porque repetir a entrega de outra OS não ajuda ninguém.
    const s = montarSugestoes(base([], [], [os({})]));
    expect(Object.keys(s.valores)).not.toContain("entrega");
  });

  it("o mais usado vem primeiro — repetição é sinal do valor certo da casa", () => {
    const s = montarSugestoes(base([projeto("Expominas"), projeto("Expominas"), projeto("Minascentro")], [], []));
    expect(s.valores.local[0]).toBe("Expominas");
  });

  it("mesma grafia com outra caixa/acento conta junto, e vale a primeira vista", () => {
    const s = montarSugestoes(base([projeto("Expominas"), projeto("EXPOMINAS")], [], []));
    expect(s.valores.local).toEqual(["Expominas"]);
  });

  it("ignora vazio e texto longo demais para ser um valor repetível", () => {
    const s = montarSugestoes(base([projeto(""), projeto("x".repeat(200))], [], []));
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
    const s = montarSugestoes(base([projeto("Teatro Sesiminas")], [], []));
    expect(filhosDe(s, "local", "Teatro Sesiminas")).toEqual({ enderecoLocal: "Rua Teatro Sesiminas" });
  });

  it("acha o vínculo mesmo com outra caixa ou acento no pai", () => {
    const s = montarSugestoes(base([projeto("Teatro Sesiminas")], [], []));
    expect(filhosDe(s, "local", "teatro sesiminas").enderecoLocal).toBe("Rua Teatro Sesiminas");
  });

  it("a produtora responsável traz telefone e e-mail juntos", () => {
    const s = montarSugestoes(base([comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br")], [], []));
    expect(filhosDe(s, "produtoraResponsavel", "Marisa")).toEqual({
      telefoneProdutora: "(31) 98888-0000",
      emailProdutora: "marisa@polobh.com.br",
    });
  });

  it("quando o histórico diverge, vence o que apareceu mais vezes", () => {
    const s = montarSugestoes(base([
        comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br"),
        comProdutora("Marisa", "(31) 98888-0000", "marisa@polobh.com.br"),
        comProdutora("Marisa", "(31) 90000-1111", "antigo@polobh.com.br"),
      ], [], []));
    expect(filhosDe(s, "produtoraResponsavel", "Marisa").telefoneProdutora).toBe("(31) 98888-0000");
  });

  it("valor que a casa nunca usou não inventa filho nenhum", () => {
    const s = montarSugestoes(base([projeto("Expominas")], [], []));
    expect(filhosDe(s, "local", "Casa Nova")).toEqual({});
    expect(filhosDe(s, "local", "")).toEqual({});
  });

  it("as ECs também alimentam o vínculo — elas guardam projetos fora da lista", () => {
    const daEc = ec([], "Minascentro");
    daEc.projeto.enderecoLocal = "Av. Augusto de Lima, 785";
    const s = montarSugestoes(base([], [daEc], []));
    expect(filhosDe(s, "local", "Minascentro").enderecoLocal).toBe("Av. Augusto de Lima, 785");
  });
});

/**
 * A cobertura é o ponto do pedido: "todo campo preenchido memoriza para os
 * próximos usos". O que estes testes protegem não é o valor de um campo, é o
 * catálogo continuar alcançando cada canto onde a casa escreve.
 */
describe("alcance da memória", () => {
  it("guarda o que se escreve dentro das listas da OS — cronograma e parcelas", () => {
    const comListas = os({});
    comListas.cronograma = [
      { id: "c1", etapa: "Montagem", data: "", horario: "08h às 18h", atividades: "Rigging e cabeamento" },
    ];
    comListas.orcamento.parcelas = [{ descricao: "50% na assinatura", valor: 0 }];
    const s = montarSugestoes(base([], [], [comListas]));
    expect(s.valores.etapaCronograma).toContain("Montagem");
    expect(s.valores.horario).toContain("08h às 18h");
    expect(s.valores.atividadesCronograma).toContain("Rigging e cabeamento");
    expect(s.valores.descricaoParcela).toContain("50% na assinatura");
  });

  it("guarda o financeiro e o contrato da OS", () => {
    const preenchida = os({});
    preenchida.financeiro = {
      ...preenchida.financeiro,
      leiIncentivo: "Lei de Incentivo à Cultura",
      projetoIncentivado: "Festival de Inverno",
      cnae: "9001-9/06",
      acertoFinanceiro: "Pagamento em 30 dias",
    };
    preenchida.contrato = {
      ...preenchida.contrato,
      formaPagamento: "À vista, no ato da emissão da nota fiscal",
      observacoesGerais: "Valores revistos em caso de execução parcial.",
      rubrica: "MMC",
    };
    const s = montarSugestoes(base([], [], [preenchida]));
    expect(s.valores.leiIncentivo).toContain("Lei de Incentivo à Cultura");
    expect(s.valores.projetoIncentivado).toContain("Festival de Inverno");
    expect(s.valores.cnae).toContain("9001-9/06");
    expect(s.valores.acertoFinanceiro).toContain("Pagamento em 30 dias");
    expect(s.valores.formaPagamento).toContain("À vista, no ato da emissão da nota fiscal");
    expect(s.valores.observacoesContrato).toContain("Valores revistos em caso de execução parcial.");
    expect(s.valores.rubrica).toContain("MMC");
  });

  it("guarda o que se escreve nas tarefas do check-list", () => {
    const s = montarSugestoes(
      base([], [], [], [checklist([tarefa({ titulo: "Fechar buffet", etapa: "PRÉ-EVENTO" })])])
    );
    expect(s.valores.tituloTarefa).toContain("Fechar buffet");
    expect(s.valores.etapaTarefa).toContain("PRÉ-EVENTO");
  });

  it("o mesmo vocabulário em dois lugares vira uma lista só", () => {
    // Código de serviço: escrito no item da EC e no financeiro da OS.
    const comCodigo = os({});
    comCodigo.financeiro = { ...comCodigo.financeiro, codigoServico: "03.01" };
    const s = montarSugestoes(base([], [ec([linha({ codigoServico: "17.02" })])], [comCodigo]));
    expect(s.valores.codigoServico).toEqual(expect.arrayContaining(["17.02", "03.01"]));
  });

  it("o banco entra na memória; agência, conta e Pix não têm campo nenhum", () => {
    const comBanco = os({});
    comBanco.fornecedor.dadosBancarios = {
      tipoConta: "PJ", banco: "Banco do Brasil (001)", agencia: "1234-5", conta: "67890-1", chavePix: "x@y.com",
    };
    const s = montarSugestoes(base([], [], [comBanco]));
    expect(s.valores.bancoFornecedor).toContain("Banco do Brasil (001)");
    // Dado que identifica UM fornecedor não vira sugestão para outro.
    const chaves = Object.keys(s.valores);
    expect(chaves).not.toContain("agencia");
    expect(chaves).not.toContain("conta");
    expect(chaves).not.toContain("chavePix");
    expect(chaves).not.toContain("cnpj");
  });

  it("todo par pai/filho colhe da mesma fonte — senão o vínculo seria aleatório", () => {
    const amostra = base(
      [projeto("Expominas"), projeto("Minascentro")],
      [ec([linha({})])],
      [os({})],
      [checklist([tarefa({})])]
    );
    expect(paresConsistentes(amostra)).toBe(true);
  });

  it("o nome do cliente traz razão social e endereço que vieram com ele", () => {
    const comCliente = projeto("Expominas");
    comCliente.cliente = {
      ...comCliente.cliente,
      nome: "Banco Mercantil",
      razaoSocial: "BANCO MERCANTIL DO BRASIL S.A.",
      endereco: "Rua Rio de Janeiro, 654 — Centro, Belo Horizonte/MG",
    };
    const s = montarSugestoes(base([comCliente], [], []));
    expect(filhosDe(s, "clienteNome", "Banco Mercantil")).toEqual({
      clienteRazaoSocial: "BANCO MERCANTIL DO BRASIL S.A.",
      clienteEndereco: "Rua Rio de Janeiro, 654 — Centro, Belo Horizonte/MG",
    });
  });
});
