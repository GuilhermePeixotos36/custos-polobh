import { describe, expect, it } from "vitest";
import {
  agregarPendencias,
  ancoraConversaAba,
  ancoraCronogramaOs,
  ancoraObservacoesGeraisEc,
  ancoraProjetoSemEc,
  ancoraProjetoSemPastaDropbox,
  calcularPendencias,
  destinatariosDaVez,
  podeConcluirPendencia,
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
  // Com a pasta do Dropbox preenchida: a pendência "falta o link" tem teste próprio.
  docsUrl: "https://www.dropbox.com/scl/fo/abc/xyz", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

const observacao = (o: Partial<Observacao>): Observacao => ({
  id: "obs-1", texto: "Confere o orçamento", autorId: "u-a", autorNome: "Ana",
  criadoEm: "2026-08-20T10:00:00Z", responsavelNome: "Bruno", resolvida: false, respostas: [], ...o,
});

const linha = (obs: Observacao[]): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Buffet", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], bv: bvVazio(),
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

  it("NÃO fica com o Produtor Responsável quando a vez é de outra pessoa", () => {
    // A conversa está com o Bruno, e é dele a ação. Carla responde pelo projeto,
    // e por um tempo (08/09/2026) via toda conversa que nascia nele — o preço
    // foi o número vermelho de quem toca seis projetos deixar de significar
    // "tenho o que fazer". A Pólobh pediu o recorte de volta em 15/09/2026:
    // conversa é de quem foi cobrado. O que não tem destinatário nominal
    // continua com ela (ver os testes de OS em rascunho e projeto sem EC).
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

  it("cobra o responsável da tarefa, e só ele", () => {
    const itens = pendenciasCom([tarefa({ responsavel: "Bruno" })]);
    expect(de(itens, "Bruno").total).toBe(1);
    // A tarefa TEM dono: o Produtor Responsável não a herda (15/09/2026).
    expect(de(itens, "Carla").total).toBe(0);
    expect(de(itens, "Ana").total).toBe(0);
  });

  it("tarefa sem responsável cai para o Produtor Responsável — ninguém fica órfão", () => {
    const itens = pendenciasCom([tarefa({ responsavel: "" })]);
    expect(de(itens, "Carla").total).toBe(1);
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

  it("item oculto não cobra nada — está guardado, fora dos totais e da tela", () => {
    const oculto = calcularPendencias(
      [projeto("Carla")],
      [ec([{ ...linha([observacao({})]), statusOs: "Emitir", oculto: true }])],
      [], USUARIOS, [], [], HOJE
    );
    // Ele só reaparece pela gaveta "Itens ocultos", sem endereço na tela: contar
    // ali era criar número que a pílula não conseguia achar.
    expect(de(oculto, "Carla").total).toBe(0);
    expect(de(oculto, "Bruno").total).toBe(0);
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
 * A promessa central do quadro de pendências: TODO número vermelho tem de ser
 * achável, e o número da pílula de localização tem de ser o mesmo do badge —
 * em qualquer etapa. Estes testes travam a igualdade nos dois pontos em que ela
 * vinha quebrando: o título da subguia EC contra a lista de ECs, e a linha da
 * listagem contra a pílula da tela que ela abre.
 */
describe("badge e pílula contam a mesma coisa", () => {
  const os = (o: Partial<Os>): Os =>
    ({
      id: "os1", ecId: "ec1", numero: "OS 01", seq: 1, status: "Rascunho",
      fornecedorRazao: "", fornecedorCnpj: "", ecLinhaIds: [], observacoes: [], cronograma: [],
      ...o,
    }) as unknown as Os;

  /** Um projeto com EC (comentário + emissão) e uma OS em rascunho com comentário. */
  const tudo = () =>
    calcularPendencias(
      [projeto("Carla")],
      [ec([{ ...linha([observacao({ responsavelNome: "Bruno" })]), statusOs: "Emitir" }])],
      [os({ observacoes: [observacao({ id: "obs-os", responsavelNome: "Bruno" })] })],
      USUARIOS, [], [checklist([tarefa({})])], HOJE
    );

  it("o título da subguia EC é a soma exata das linhas da lista de ECs", () => {
    const meus = de(tudo(), "Carla");
    expect(meus.porAba["p1:ec"]).toBe(meus.porEc["ec1"]);
  });

  it("a lista de ECs não conta o que se resolve dentro da OS", () => {
    const meus = de(tudo(), "Carla");
    // A OS carrega o `ecId` de origem: era por ele que as pendências da OS
    // entravam no badge da linha da EC, onde não havia como achá-las.
    expect(meus.porEc["ec1"]).toBe(
      meus.itens.filter((p) => p.ecId === "ec1" && p.aba === "ec").length
    );
    expect(meus.porOs["os1"]).toBeGreaterThan(0);
  });

  it("o badge da linha é o número que a pílula mostra ao abrir aquela tela", () => {
    const meus = de(tudo(), "Carla");
    expect(pendenciasDaTela(meus.itens, { ecId: "ec1" })).toHaveLength(meus.porEc["ec1"]);
    expect(pendenciasDaTela(meus.itens, { osId: "os1" })).toHaveLength(meus.porOs["os1"]);
  });

  it("o badge da subguia é o número que a pílula mostra naquela subguia", () => {
    const meus = de(tudo(), "Carla");
    for (const aba of ["ec", "os", "checklist", "credenciamento", "cronograma"] as const) {
      expect(pendenciasDaTela(meus.itens, { projetoId: "p1", aba })).toHaveLength(
        meus.porAba[`p1:${aba}`] ?? 0
      );
    }
  });

  it("o badge do projeto é a soma das subguias, e o sininho a soma dos projetos", () => {
    const meus = de(tudo(), "Carla");
    const somaAbas = Object.entries(meus.porAba)
      .filter(([k]) => k.startsWith("p1:"))
      .reduce((t, [, n]) => t + n, 0);
    expect(meus.porProjeto["p1"]).toBe(somaAbas);
    expect(meus.total).toBe(meus.itens.length);
  });

  it("cronograma vazio da OS é cobrado na subguia Cronograma, na linha do fornecedor", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([])])],
      [os({ status: "Emitida", disparadaEm: "2026-08-20T10:00:00Z", cronograma: [] })],
      USUARIOS, [], [], HOJE
    );
    const p = itens.find((x) => x.tipo === "os.cronograma")!;
    expect(p.aba).toBe("cronograma");
    expect(p.ancora).toBe(ancoraCronogramaOs("os1"));
    expect(rotaDaPendencia(p)).toContain("aba=cronograma");
  });

  it("fornecedor sem telefone/e-mail nos Dados Úteis é cobrado na aba Fornecedores, uma vez por fornecedor", () => {
    const sem = { fornecedor: { razaoSocial: "Som Ltda", cnpj: "11", telefone: "", email: "" } } as Partial<Os>;
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([])])],
      [os({ status: "Emitida", disparadaEm: "2026-08-20T10:00:00Z", cronograma: [{ etapa: "E" } as never], ...sem }), os({ id: "os2", status: "Emitida", disparadaEm: "2026-08-20T10:00:00Z", cronograma: [{ etapa: "E" } as never], ...sem })],
      USUARIOS, [], [], HOJE
    );
    const ps = itens.filter((x) => x.tipo === "fornecedor.contato");
    expect(ps).toHaveLength(1);
    expect(ps[0].aba).toBe("fornecedores");
    expect(ps[0].titulo).toContain("telefone e e-mail");
    expect(ps[0].ancora).toContain("fornecedor-util:");
  });

  it("credenciamento sem resposta é achável na linha do painel do projeto", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [ec([linha([])])],
      [os({ status: "Emitida", disparadaEm: "2026-08-20T10:00:00Z", cronograma: [{ etapa: "Evento" }], credenciamento: { prazoLimite: "2026-09-01" } } as Partial<Os>)],
      USUARIOS, [], [], HOJE
    );
    const p = itens.find((x) => x.tipo === "os.credenciamento")!;
    expect(p.ancora).toBe("os1");
    expect(rotaDaPendencia(p)).toBe("/projetos/p1?aba=credenciamento");
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

  it("no projeto, a aba EC alcança o que mora na EC — pela LINHA da lista", () => {
    // O número do título da subguia é a soma das linhas da lista de ECs, então a
    // pílula de lá precisa alcançar as mesmas pendências. Elas não saem da tela:
    // a âncora deixa de ser o item da EC e passa a ser a linha da listagem.
    const daAba = pendenciasDaTela(tudo(), { projetoId: "p1", aba: "ec" });
    expect(daAba.map((p) => p.tipo)).toEqual(["ec.observacao"]);
    expect(daAba[0].ancora).toBe("ec1");
    // O comentário exato fica para a tela da EC — aqui não há thread para abrir.
    expect(daAba[0].observacaoId).toBeUndefined();
  });

  it("na aba OS, a pílula alcança a OS pela linha da lista", () => {
    const daAba = pendenciasDaTela(tudo(), { projetoId: "p1", aba: "os" });
    expect(daAba.every((p) => p.ancora === "os1")).toBe(true);
    expect(daAba.length).toBeGreaterThan(0);
  });

  it("no projeto, o check-list é da própria tela e continua na roda", () => {
    const itens = calcularPendencias(
      [projeto("Carla")], [], [], USUARIOS, [], [checklist([tarefa({})])], HOJE
    );
    const daAba = pendenciasDaTela(itens, { projetoId: "p1", aba: "checklist" });
    expect(daAba.map((p) => p.ancora)).toEqual(["i1"]);
  });

  it("toda pendência tem âncora — número sem endereço é o que fazia badge e pílula discordarem", () => {
    const tudoQuePodeExistir = [
      ...tudo(),
      ...calcularPendencias([projeto("Carla")], [], [], USUARIOS, [], [checklist([tarefa({})])], HOJE),
    ];
    expect(tudoQuePodeExistir.every((p) => !!p.ancora)).toBe(true);
  });

  it("'projeto sem estimativa' é localizável no cabeçalho da subguia EC", () => {
    const semEc = calcularPendencias([projeto("Carla")], [], [], USUARIOS, [], [], HOJE);
    const p = semEc.find((x) => x.tipo === "projeto.semEc");
    expect(p?.ancora).toBe(ancoraProjetoSemEc("p1"));
    expect(pendenciasDaTela(semEc, { projetoId: "p1", aba: "ec" }).map((x) => x.tipo)).toEqual([
      "projeto.semEc",
    ]);
  });
});

describe("projeto sem a pasta do Dropbox", () => {
  const semPasta = (extra: Partial<Projeto> = {}): Projeto => ({ ...projeto("Carla"), docsUrl: "", ...extra });
  const dela = (ps: Projeto[]) =>
    calcularPendencias(ps, [], [], USUARIOS, [], [], HOJE).find((x) => x.tipo === "projeto.semPastaDropbox");

  it("cobra o Produtor Responsável, em Dados Gerais, com âncora no campo do link", () => {
    const p = dela([semPasta()]);
    expect(p?.pessoas).toEqual(["Carla"]);
    expect(p?.aba).toBe("dados");
    expect(p?.ancora).toBe(ancoraProjetoSemPastaDropbox("p1"));
  });

  it("com o link da pasta preenchido, não cobra", () => {
    expect(dela([projeto("Carla")])).toBeUndefined();
  });

  it("link que não é do Dropbox não vale — o servidor recusaria", () => {
    expect(dela([semPasta({ docsUrl: "https://drive.google.com/drive/folders/1" })])).toBeDefined();
    expect(dela([semPasta({ docsUrl: "https://www.dropbox.com/scl/fo/abc" })])).toBeUndefined();
    expect(dela([semPasta({ docsUrl: "https://dropbox.com/home/Projeto" })])).toBeUndefined();
  });

  it("sem Produtor Responsável não há para quem cobrar", () => {
    expect(dela([{ ...semPasta(), info: { ...semPasta().info, produtoraResponsavel: "" } }])).toBeUndefined();
  });

  it("projeto arquivado (todas as ECs arquivadas) não cobra — mesma régua do 'sem EC'", () => {
    const arquivada = { ...ec([]), projetoId: "p1", ativa: false, status: "Arquivada" as const };
    const todas = calcularPendencias([semPasta()], [arquivada], [], USUARIOS, [], [], HOJE);
    expect(todas.find((x) => x.tipo === "projeto.semPastaDropbox")).toBeUndefined();
  });

  it("aparece na subguia Dados Gerais do projeto", () => {
    const todas = calcularPendencias([semPasta()], [], [], USUARIOS, [], [], HOJE);
    expect(pendenciasDaTela(todas, { projetoId: "p1", aba: "dados" }).map((x) => x.tipo)).toContain(
      "projeto.semPastaDropbox"
    );
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

  /**
   * O lembrete para si mesmo (24/09/2026).
   *
   * Escrever um recado escolhendo a si mesma no "Para" é como se anota "não
   * esquecer disto". A regra de tirar o autor da vez — que existe para um
   * comentário não acender bolinha para quem acabou de escrevê-lo — estava
   * comendo esse caso: o recado era gravado, aparecia na conversa, e não virava
   * pendência para ninguém.
   */
  it("quem se endereça a si mesmo fica com a própria pendência", () => {
    const paraMim = observacao({ autorNome: "Ana", texto: "testeteste", responsavelNome: "Ana" });
    expect(destinatariosDaVez(paraMim, USUARIOS)).toEqual(["Ana"]);
  });

  it("o mesmo vale pela menção, e junto com outra pessoa", () => {
    const o = observacao({ autorNome: "Ana", texto: "@Ana não esquecer, e @Bruno confirma", responsavelNome: "" });
    expect(destinatariosDaVez(o, USUARIOS).sort()).toEqual(["Ana", "Bruno"]);
  });

  // A volta automática da bola é DEDUÇÃO nossa, não intenção de ninguém — essa
  // continua nunca apontando para quem acabou de falar.
  it("mas a devolução automática continua sem voltar para o próprio autor", () => {
    const o = observacao({
      autorNome: "Ana",
      texto: "@Bruno confere o orçamento",
      responsavelNome: "",
      respostas: [resposta("Bruno", "conferido"), resposta("Ana", "obrigada!")],
    });
    expect(destinatariosDaVez(o, USUARIOS)).toEqual(["Bruno"]);
  });

  // Endereçar-se vale na RAIZ, que é onde o campo "Para" existe. Depois que a
  // conversa anda, quem manda é a última mensagem: o lembrete não fica colado
  // na thread — ele volta a ser uma conversa normal, e aqui a bola volta para a
  // Ana porque foi o Bruno quem falou por último.
  it("virando conversa, o lembrete segue a regra normal da vez", () => {
    const o = observacao({
      autorNome: "Ana",
      texto: "testeteste",
      responsavelNome: "Ana",
      respostas: [resposta("Bruno", "já cuidei disso")],
    });
    expect(destinatariosDaVez(o, USUARIOS)).toEqual(["Ana"]);
  });

  it("o lembrete para si mesmo aparece no quadro de quem o escreveu", () => {
    const itens = calcularPendencias(
      [projeto("Carla")],
      [ec([linha([observacao({ autorNome: "Ana", texto: "testeteste", responsavelNome: "Ana" })])])],
      [], USUARIOS, [], [], HOJE,
    );
    expect(de(itens, "Ana").total).toBe(1);
    expect(de(itens, "Bruno").total).toBe(0);
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

/**
 * A conversa geral de cada ABA do projeto — o corredor da etapa.
 *
 * Ela responde à mesma régua das outras: quem foi @mencionado fica com a vez, e
 * o Produtor Responsável enxerga o que acontece no projeto dele. O que muda é o
 * ENDEREÇO: a pendência mora na aba, então é ali que ela é contada e é para lá
 * que o navegador leva.
 */
describe("conversa das abas do projeto", () => {
  const comConversa = (conversas: Projeto["conversas"]): Projeto => ({ ...projeto("Ana"), conversas });

  const daAba = (conversas: Projeto["conversas"], usuario: string) =>
    calcularPendencias([comConversa(conversas)], [], [], [usuario], [], [], HOJE)
      .filter((p) => p.tipo === "projeto.conversa");

  it("cobra quem foi mencionado, na aba onde a conversa está", () => {
    const [p] = daAba({ credenciamento: [observacao({ responsavelNome: "Bruno" })] }, "Bruno");
    expect(p.aba).toBe("credenciamento");
    expect(p.projetoId).toBe("p1");
    expect(p.pessoas).toContain("Bruno");
    // O aviso diz de que etapa se trata — "em Credenciamento", não "em p1".
    expect(p.titulo).toContain("Credenciamento");
  });

  it("a âncora leva ao card daquela aba, e não ao projeto", () => {
    const [p] = daAba({ cronograma: [observacao({ responsavelNome: "Bruno" })] }, "Bruno");
    expect(p.ancora).toBe(ancoraConversaAba("p1", "cronograma"));
    // Duas abas do mesmo projeto não podem cair no mesmo lugar.
    expect(ancoraConversaAba("p1", "cronograma")).not.toBe(ancoraConversaAba("p1", "ec"));
  });

  it("cada aba responde por si — conversas separadas, pendências separadas", () => {
    const itens = daAba(
      {
        cronograma: [observacao({ id: "a", responsavelNome: "Bruno" })],
        fornecedores: [observacao({ id: "b", responsavelNome: "Bruno" })],
      },
      "Bruno"
    );
    expect(itens.map((p) => p.aba).sort()).toEqual(["cronograma", "fornecedores"]);
    // Ids distintos: duas pendências, e não uma contada duas vezes.
    expect(new Set(itens.map((p) => p.id)).size).toBe(2);
  });

  // A conversa da LISTAGEM de ECs e de OSs saiu das telas (15/09/2026), e o que
  // ficou gravado lá não pode continuar cobrando: seria um número vermelho sem
  // nenhuma tela onde resolvê-lo. Dentro da EC e da OS a conversa continua.
  it("conversa gravada nas abas EC e OS não cobra mais ninguém", () => {
    expect(daAba({ ec: [observacao({ responsavelNome: "Bruno" })] }, "Bruno")).toEqual([]);
    expect(daAba({ os: [observacao({ responsavelNome: "Bruno" })] }, "Bruno")).toEqual([]);
  });

  it("observação resolvida não cobra mais ninguém", () => {
    expect(daAba({ cronograma: [observacao({ resolvida: true, responsavelNome: "Bruno" })] }, "Bruno")).toEqual([]);
  });

  it("a conversa da aba não carrega o Produtor Responsável", () => {
    const [p] = daAba({ cronograma: [observacao({ responsavelNome: "Bruno" })] }, "Bruno");
    expect(p.responsavelProjeto).toBeUndefined();
    expect(p.pessoas).toEqual(["Bruno"]);
  });

  it("projeto sem conversa nenhuma não gera nada", () => {
    expect(daAba({}, "Bruno")).toEqual([]);
    expect(daAba(undefined, "Bruno")).toEqual([]);
  });
});

describe("podeConcluirPendencia", () => {
  const obs = { id: "o1", texto: "x", autorId: "u1", autorNome: "Ana", criadoEm: "2026-09-29T10:00:00Z" } as Observacao;
  it("o autor da observação conclui", () => {
    expect(podeConcluirPendencia(obs, { id: "u1", papel: "Producao" })).toBe(true);
  });
  it("quem só foi mencionado não conclui", () => {
    expect(podeConcluirPendencia(obs, { id: "u2", papel: "Producao" })).toBe(false);
  });
  it("Direção, Administrador e a área Coordenação sempre concluem", () => {
    expect(podeConcluirPendencia(obs, { id: "u2", papel: "Direcao" })).toBe(true);
    expect(podeConcluirPendencia(obs, { id: "u2", papel: "Admin" })).toBe(true);
    expect(podeConcluirPendencia(obs, { id: "u2", papel: "Producao", areaNome: "Coordenação" })).toBe(true);
  });
  it("já resolvida, ninguém conclui de novo", () => {
    expect(podeConcluirPendencia({ ...obs, resolvida: true }, { id: "u1", papel: "Direcao" })).toBe(false);
  });
});

describe("item aprovado sem os dados do fornecedor", () => {
  const com = (extra: Partial<EcLinha>) =>
    calcularPendencias([projeto("Carla")], [ec([{ ...linha([]), ...extra }])], [], USUARIOS, [], [], HOJE)
      .filter((p) => p.tipo === "ec.fornecedor");

  it("cobra da produtora o CNPJ e a razão social quando a Aprovação está OK", () => {
    const [p] = com({ statusAprovacao: "OK" });
    expect(p.responsavelProjeto).toBe("Carla");
    expect(p.ancora).toBe("l1");
  });

  it("não cobra enquanto o item está pendente, nem quando o fornecedor está completo", () => {
    expect(com({ statusAprovacao: "Pendente" })).toHaveLength(0);
    expect(com({ statusAprovacao: "OK", fornecedorRazao: "Buffet Ltda", fornecedorCnpj: "12.345.678/0001-90" })).toHaveLength(0);
  });

  it("CNPJ incompleto conta como faltando", () => {
    expect(com({ statusAprovacao: "OK", fornecedorRazao: "Buffet Ltda", fornecedorCnpj: "12.345" })).toHaveLength(1);
  });

  it("CPF completo vale como documento do fornecedor", () => {
    expect(com({ statusAprovacao: "OK", fornecedorRazao: "Carolina Estelian", fornecedorCnpj: "055.650.834-35" })).toHaveLength(0);
  });

  it("item com OS 'Não se Aplica' (só descrito, sem OS) não cobra fornecedor", () => {
    expect(com({ statusAprovacao: "OK", statusOs: "Não se Aplica" })).toHaveLength(0);
  });
});
