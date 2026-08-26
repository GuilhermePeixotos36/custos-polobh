import { describe, expect, it } from "vitest";
import { agregarPendencias, calcularPendencias, rotaDaPendencia, type Pendencia } from "./pendencias";
import { projetoInfoVazio } from "./projeto";
import { honorariosPadrao, encargosPadrao, producaoZerada } from "./calc";
import type { Checklist, Cliente, Ec, EcLinha, ItemChecklist, Observacao, Projeto } from "@/data/types";

const HOJE = "2026-08-25";

const clienteVazio = (): Cliente => ({
  id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "ACME LTDA", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});

/** Projeto com Produtor Responsável definido — é ele quem responde pelo todo. */
const projeto = (responsavel: string): Projeto => ({
  id: "p1", nome: "Convenção", cliente: clienteVazio(),
  info: { ...projetoInfoVazio(), titulo: "Convenção", produtoraResponsavel: responsavel },
  docsUrl: "", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

const observacao = (o: Partial<Observacao>): Observacao => ({
  id: "obs-1", texto: "Confere o orçamento", autorId: "u-a", autorNome: "Ana",
  criadoEm: "2026-08-20T10:00:00Z", responsavelNome: "Bruno", resolvida: false, respostas: [], ...o,
});

const linha = (obs: Observacao[]): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Buffet", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], opcaoValor: "",
  statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
  codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: obs, oculto: false, ordem: 0,
});

const ec = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "", versao: 1, status: "Rascunho",
  projetoId: "p1", template: "", clienteId: "c1", cliente: clienteVazio(),
  projeto: { ...projetoInfoVazio(), titulo: "Convenção" }, linhas,
  producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "", validadeDias: 30, criadoEm: "", atualizadoEm: "", ativa: true,
});

const tarefa = (p: Partial<ItemChecklist>): ItemChecklist => ({
  id: "i1", checklistId: "cl1", origemModeloItemId: "", titulo: "Fechar buffet", descricao: "",
  etapa: "PRÉ-EVENTO", status: "Pendente", dataLimite: HOJE, dataManual: false,
  concluidoEm: "", concluidoPor: "", responsavel: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const checklist = (itens: ItemChecklist[]): Checklist => ({
  id: "cl1", projetoId: "p1", modalidade: "Corporativo", modeloId: "m1", itens,
  criadoEm: "", atualizadoEm: "",
});

const USUARIOS = ["Ana", "Bruno", "Carla"];
const de = (itens: Pendencia[], pessoa: string) => agregarPendencias(itens, pessoa);

describe("quem vê a pendência de uma observação", () => {
  // Ana (autora) cobra Bruno num projeto cuja responsável é Carla.
  const itens = calcularPendencias(
    [projeto("Carla")], [ec([linha([observacao({})])])], [], USUARIOS, [], [], HOJE
  );

  it("chega a quem foi cobrado", () => {
    expect(de(itens, "Bruno").total).toBe(1);
  });

  it("não fica com quem cobrou — cobrar não é ter o que fazer", () => {
    // Ana escreveu a observação; a tarefa é do Bruno. O número vermelho é lista
    // de tarefa, não acompanhamento (regra revista em 26/08/2026).
    expect(de(itens, "Ana").total).toBe(0);
  });

  it("conta para o Produtor Responsável, mesmo sem ele ter sido citado", () => {
    // Era exatamente o que faltava: Carla via um número maior no badge e não
    // achava a pendência, porque a lista dela e a do navegador eram outras.
    expect(de(itens, "Carla").total).toBe(1);
  });

  it("não aparece para quem não tem nada com ela", () => {
    expect(de(itens, "Daniel").total).toBe(0);
  });

  it("leva o endereço da tela: item e comentário exatos", () => {
    const p = de(itens, "Bruno").itens[0];
    expect(p.ancora).toBe("l1");
    expect(p.observacaoId).toBe("obs-1");
    expect(p.ecId).toBe("ec1");
  });

  it("observação resolvida deixa de cobrar todo mundo", () => {
    const resolvidas = calcularPendencias(
      [projeto("Carla")], [ec([linha([observacao({ resolvida: true })])])], [], USUARIOS, [], [], HOJE
    );
    expect(de(resolvidas, "Bruno").total).toBe(0);
    expect(de(resolvidas, "Carla").total).toBe(0);
  });
});

describe("tarefa do check-list vira pendência", () => {
  // A EC vazia entra só para o projeto não gerar, por tabela, a pendência
  // "Projeto sem estimativa" e embaralhar a contagem.
  const pendenciasCom = (itensChecklist: ItemChecklist[]) =>
    calcularPendencias([projeto("Carla")], [ec([])], [], USUARIOS, [], [checklist(itensChecklist)], HOJE);

  it("hoje e o que já venceu são pendência", () => {
    const hoje = pendenciasCom([tarefa({ id: "hoje", dataLimite: HOJE })]);
    const atrasada = pendenciasCom([tarefa({ id: "ontem", dataLimite: "2026-08-20" })]);
    expect(de(hoje, "Carla").total).toBe(1);
    expect(de(atrasada, "Carla").total).toBe(1);
    expect(de(atrasada, "Carla").itens[0].titulo).toContain("atrasada");
  });

  it("o que ainda tem prazo não infla o badge — fica na Agenda", () => {
    const depois = pendenciasCom([tarefa({ id: "depois", dataLimite: "2026-08-27" })]);
    expect(de(depois, "Carla").total).toBe(0);
  });

  it("cobra o responsável da tarefa quando há um", () => {
    const itens = pendenciasCom([tarefa({ responsavel: "Bruno" })]);
    expect(de(itens, "Bruno").total).toBe(1);
    // ...e o Produtor Responsável continua vendo, porque o projeto é dele.
    expect(de(itens, "Carla").total).toBe(1);
    expect(de(itens, "Ana").total).toBe(0);
  });

  it("tarefa concluída não cobra mais nada", () => {
    const itens = pendenciasCom([tarefa({ status: "Concluído", dataLimite: "2026-08-20" })]);
    expect(de(itens, "Carla").total).toBe(0);
  });

  it("aponta para o item na tela do check-list", () => {
    const p = de(pendenciasCom([tarefa({})]), "Carla").itens[0];
    expect(p.aba).toBe("checklist");
    expect(p.ancora).toBe("i1");
  });
});

describe("item de EC com OS ou Contrato a emitir", () => {
  const comStatus = (campo: "statusOs" | "contratoStatus", status: EcLinha["statusOs"]) =>
    calcularPendencias(
      [projeto("Carla")], [ec([{ ...linha([]), [campo]: status }])], [], USUARIOS, [], [], HOJE
    );

  it("cobra a emissão da OS do Produtor Responsável", () => {
    const itens = comStatus("statusOs", "Emitir");
    expect(de(itens, "Carla").total).toBe(1);
    expect(de(itens, "Carla").itens[0].campo).toBe("os");
  });

  it("cobra também o contrato, e 'Emitir Nova Versão' conta igual", () => {
    const itens = comStatus("contratoStatus", "Emitir Nova Versão");
    const p = de(itens, "Carla").itens[0];
    expect(p.campo).toBe("contrato");
    expect(p.titulo).toContain("Emitir Nova Versão");
  });

  it("status resolvido não cobra nada", () => {
    expect(de(comStatus("statusOs", "OK"), "Carla").total).toBe(0);
    expect(de(comStatus("statusOs", "Não se Aplica"), "Carla").total).toBe(0);
  });

  it("leva até o item da EC — e não a uma pendência sem endereço", () => {
    const p = de(comStatus("statusOs", "Emitir"), "Carla").itens[0];
    expect(p.ancora).toBe("l1");
    expect(p.ecId).toBe("ec1");
    expect(rotaDaPendencia(p)).toBe("/estimativas/ec1");
  });

  it("não aparece para quem não responde pelo projeto", () => {
    expect(de(comStatus("statusOs", "Emitir"), "Bruno").total).toBe(0);
  });
});

describe("agregação por tela", () => {
  it("o badge da aba e o navegador saem da mesma lista", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([observacao({})])])], [], USUARIOS, [], [checklist([tarefa({})])], HOJE
    );
    const carla = de(itens, "Carla");
    expect(carla.porAba["p1:ec"]).toBe(carla.itens.filter((p) => p.aba === "ec").length);
    expect(carla.porAba["p1:checklist"]).toBe(carla.itens.filter((p) => p.aba === "checklist").length);
    expect(carla.porProjeto["p1"]).toBe(carla.total);
  });

  it("toda pendência sabe para qual tela levar", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([observacao({})])])], [], USUARIOS, [], [checklist([tarefa({})])], HOJE
    );
    for (const p of de(itens, "Carla").itens) expect(rotaDaPendencia(p)).not.toBe("/projetos");
  });
});
