import { describe, expect, it } from "vitest";
import {
  agregarPendencias,
  ancoraObservacoesGeraisEc,
  calcularPendencias,
  destinatariosDaVez,
  pendenciasDaTela,
  rotaDaPendencia,
  type Pendencia,
} from "./pendencias";
import { projetoInfoVazio } from "./projeto";
import { honorariosPadrao, encargosPadrao, producaoZerada,
  bvVazio,
} from "./calc";
import type { Checklist, Cliente, Ec, EcLinha, ItemChecklist, Observacao, Os, Projeto } from "@/data/types";

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
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], opcaoValor: "", bv: bvVazio(),
  statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
  codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: obs, oculto: false, ordem: 0,
});

const ec = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "", versao: 1, status: "Rascunho",
  projetoId: "p1", template: "", clienteId: "c1", cliente: clienteVazio(),
  projeto: { ...projetoInfoVazio(), titulo: "Convenção" }, observacoes: [], linhas,
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

  it("não fica com o Produtor Responsável quando a vez é de outra pessoa", () => {
    // A conversa está com o Bruno. Carla responde pelo projeto, mas empilhar no
    // badge dela toda conversa que anda entre duas colegas é ruído: ela entra
    // quando a vez é dela (ver `destinatariosDaVez`).
    expect(de(itens, "Carla").total).toBe(0);
  });

  it("conta para o Produtor Responsável quando a vez é dele", () => {
    const paraCarla = calcularPendencias(
      [projeto("Carla")],
      [ec([linha([observacao({ responsavelNome: "Carla" })])])],
      [], USUARIOS, [], [], HOJE
    );
    expect(de(paraCarla, "Carla").total).toBe(1);
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
    expect(de(itens, "Carla").itens[0].campos).toEqual(["os"]);
  });

  it("cobra também o contrato, e 'Emitir Nova Versão' conta igual", () => {
    const itens = comStatus("contratoStatus", "Emitir Nova Versão");
    const p = de(itens, "Carla").itens[0];
    expect(p.campos).toEqual(["contrato"]);
    expect(p.titulo).toContain("Emitir Nova Versão");
  });

  it("OS e Contrato do mesmo item são UMA pendência, não duas", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [ec([{ ...linha([]), statusOs: "Emitir", contratoStatus: "Emitir" }])],
      [], USUARIOS, [], [], HOJE
    );
    const meus = de(itens, "Carla");
    expect(meus.total).toBe(1);
    expect(meus.itens[0].campos).toEqual(["os", "contrato"]);
    // Pedem a mesma coisa: falam juntos, em vez de repetir o status duas vezes.
    expect(meus.itens[0].titulo).toContain("OS e Contrato — Emitir");
  });

  it("quando os dois pedem coisas diferentes, cada um traz o seu status", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [ec([{ ...linha([]), statusOs: "Emitir", contratoStatus: "Emitir Nova Versão" }])],
      [], USUARIOS, [], [], HOJE
    );
    const p = de(itens, "Carla").itens[0];
    expect(p.titulo).toContain("OS — Emitir · Contrato — Emitir Nova Versão");
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
      [projeto("Carla")],
      [ec([linha([observacao({ responsavelNome: "Carla" })])])],
      [], USUARIOS, [], [checklist([tarefa({})])], HOJE
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

/**
 * O recorte da pílula do canto inferior direito. Ela anda em roda: uma pendência
 * de outra tela quebrava a roda, porque o salto virava navegação e a tela de
 * destino já não tinha a lista de onde se veio.
 */
describe("o que a pílula alcança sem sair da tela", () => {
  const os = (o: Partial<Os>): Os =>
    ({
      id: "os1", ecId: "ec1", numero: "OS 01", seq: 1, status: "Rascunho",
      fornecedorRazao: "", fornecedorCnpj: "", ecLinhaIds: [], observacoes: [], cronograma: [],
      ...o,
    }) as unknown as Os;

  /** Uma EC com observação num item e a OS dela com observação própria. */
  const tudo = () =>
    calcularPendencias(
      [projeto("Carla")],
      [ec([linha([observacao({ responsavelNome: "Bruno" })])])],
      [os({ observacoes: [observacao({ id: "obs-os", responsavelNome: "Bruno" })] })],
      USUARIOS, [], [], HOJE
    );

  it("na EC, mostra as pendências do item — não as que moram na OS", () => {
    const daEc = pendenciasDaTela(tudo(), { ecId: "ec1" });
    expect(daEc.map((p) => p.tipo)).toEqual(["ec.observacao"]);
  });

  it("na OS, mostra as da OS — não as da EC que a originou", () => {
    const daOs = pendenciasDaTela(tudo(), { osId: "os1" });
    expect(daOs.every((p) => p.osId === "os1")).toBe(true);
    expect(daOs.some((p) => p.tipo === "ec.observacao")).toBe(false);
  });

  it("no projeto, a aba EC não oferece o que se resolve dentro da EC", () => {
    expect(pendenciasDaTela(tudo(), { projetoId: "p1", aba: "ec" })).toEqual([]);
  });

  it("no projeto, o check-list é da própria tela e continua na roda", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [], [], USUARIOS, [], [checklist([tarefa({})])], HOJE
    );
    const daAba = pendenciasDaTela(itens, { projetoId: "p1", aba: "checklist" });
    expect(daAba.map((p) => p.ancora)).toEqual(["i1"]);
  });

  it("pendência sem âncora fica de fora: a seta não teria para onde levar", () => {
    const semEc = calcularPendencias([projeto("Carla")], [], [], USUARIOS, [], [], HOJE);
    // Ela existe e continua no sininho — só não entra na roda da tela.
    expect(semEc.some((p) => p.tipo === "projeto.semEc")).toBe(true);
    expect(pendenciasDaTela(semEc, { projetoId: "p1", aba: "ec" })).toEqual([]);
  });
});

/* ------------------------------ batata quente ----------------------------- */

const resposta = (autorNome: string, texto: string, id = `r-${autorNome}-${texto.length}`) => ({
  id, texto, autorId: `u-${autorNome}`, autorNome, criadoEm: "2026-08-21T10:00:00Z",
});

describe("de quem é a vez na conversa", () => {
  it("começa com quem foi cobrado — por menção e pelo responsável do campo", () => {
    const o = observacao({ texto: "@Bruno confere o orçamento", responsavelNome: "Carla" });
    expect(destinatariosDaVez(o, USUARIOS).sort()).toEqual(["Bruno", "Carla"]);
  });

  it("quem responde larga a batata: ela volta para quem estava esperando", () => {
    const o = observacao({
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "conferido, tudo certo")],
    });
    // Bruno agiu — some da lista dele; a bola volta para a Ana, que cobrou.
    expect(destinatariosDaVez(o, USUARIOS)).toEqual(["Ana"]);
  });

  it("a resposta pode passar a batata para uma terceira pessoa", () => {
    const o = observacao({
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "isso é com a @Carla")],
    });
    expect(destinatariosDaVez(o, USUARIOS)).toEqual(["Carla"]);
  });

  it("vai e volta a cada resposta, até alguém resolver", () => {
    const ida = observacao({
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "conferido")],
    });
    const volta = observacao({
      ...ida,
      respostas: [...(ida.respostas ?? []), resposta("Ana", "obrigada!")],
    });
    expect(destinatariosDaVez(ida, USUARIOS)).toEqual(["Ana"]);
    expect(destinatariosDaVez(volta, USUARIOS)).toEqual(["Bruno"]);
  });

  it("quem fala duas vezes seguidas não fica com a própria batata", () => {
    const o = observacao({
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "olhando"), resposta("Bruno", "achei o erro")],
    });
    expect(destinatariosDaVez(o, USUARIOS)).toEqual(["Ana"]);
  });

  it("recado que não endereça nem responde a ninguém não cobra ninguém", () => {
    expect(destinatariosDaVez(observacao({ texto: "anotando aqui", responsavelNome: "" }), USUARIOS)).toEqual([]);
  });

  it("resolvida some do quadro de qualquer pessoa", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([observacao({ resolvida: true })])])], [], USUARIOS, [], [], HOJE
    );
    expect(de(itens, "Bruno").total).toBe(0);
    expect(de(itens, "Carla").total).toBe(0);
  });

  it("responder tira a bolinha de quem respondeu e acende a de quem cobrou", () => {
    const comResposta = ec([linha([observacao({
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "conferido")],
    })])]);
    const itens = calcularPendencias([projeto("Carla")], [comResposta], [], USUARIOS, [], [], HOJE);
    expect(de(itens, "Bruno").total).toBe(0);
    expect(de(itens, "Ana").total).toBe(1);
  });
});

describe("conversa geral da EC", () => {
  const comGeral = (o: Observacao): Ec => ({ ...ec([linha([])]), observacoes: [o] });

  it("vira pendência de quem foi mencionado", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [comGeral(observacao({ id: "g1", texto: "@Bruno o cliente cortou o coffee break", responsavelNome: "" }))],
      [], USUARIOS, [], [], HOJE
    );
    const [p] = de(itens, "Bruno").itens;
    expect(p.tipo).toBe("ec.observacaoGeral");
    expect(p.ecId).toBe("ec1");
    expect(p.aba).toBe("ec");
    expect(p.ancora).toBe(ancoraObservacoesGeraisEc("ec1"));
    expect(rotaDaPendencia(p)).toBe("/estimativas/ec1");
  });

  it("segue a mesma batata quente das observações de item", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [comGeral(observacao({
        id: "g1", texto: "@Bruno o cliente cortou o coffee break", responsavelNome: "",
        respostas: [resposta("Bruno", "ajustado")],
      }))],
      [], USUARIOS, [], [], HOJE
    );
    expect(de(itens, "Bruno").total).toBe(0);
    expect(de(itens, "Ana").total).toBe(1);
  });

  it("o navegador da tela da EC alcança a conversa geral", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [comGeral(observacao({ id: "g1", texto: "@Bruno urgente", responsavelNome: "" }))],
      [], USUARIOS, [], [], HOJE
    );
    expect(pendenciasDaTela(de(itens, "Bruno").itens, { ecId: "ec1" })).toHaveLength(1);
  });
});
