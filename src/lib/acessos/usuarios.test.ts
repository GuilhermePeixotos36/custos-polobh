/** Regras puras da lista de usuários e dos grupos (padrão de Acessos LSPRO, testes.md bloco 3). */
import { describe, expect, it } from "vitest";
import type { GrupoAcesso, UsuarioDoAcesso } from "./acessosStore";
import {
  acoesDaLinha, caixasDeEspeciais, especiaisMudaram, especiaisValidas, filtrarUsuarios, filtrosAtivosDeUsuarios,
  FILTROS_VAZIOS, grafiaExistente, gruposEscolheveis, gruposQuePossoConceder, motivoDeEdicaoTravada,
  motivoDeNaoInativarGrupo, semGrupoAlemDoSistema, sugestoesDistintas,
} from "./usuarios";

const usuario = (u: Partial<UsuarioDoAcesso>): UsuarioDoAcesso => ({
  id: "u", nome: "", email: "", cargo: "", setor: "", telefone: "", grupoId: null, status: "ativo", ultimoAcesso: "", especiais: [], ...u,
});

const grupo = (g: Partial<GrupoAcesso>): GrupoAcesso => ({
  id: "g", nome: "Grupo", descricao: "", sistema: false, ativo: true, padrao: false, nivel: "Producao",
  usuariosAtivos: 0, usuarios: 0, permissoes: [], ...g,
});

describe("filtro da lista", () => {
  const lista = [
    usuario({ id: "1", nome: "Zé Ninguém", email: "ze@x.com", grupoId: "a", status: "ativo", setor: "Produção" }),
    usuario({ id: "2", nome: "Ângela Souza", email: "angela@x.com", grupoId: "b", status: "inativo", cargo: "Coordenadora" }),
    usuario({ id: "3", nome: "", email: "pendente@x.com", grupoId: null, status: "pendente" }),
  ];

  it("ordena por nome sem olhar acento (sem nome, pelo e-mail)", () => {
    expect(filtrarUsuarios(lista, FILTROS_VAZIOS).map((u) => u.id)).toEqual(["2", "3", "1"]);
  });

  it("filtra por grupo, status e busca sem acento (nome, e-mail, cargo e setor)", () => {
    expect(filtrarUsuarios(lista, { ...FILTROS_VAZIOS, grupoId: "a" }).map((u) => u.id)).toEqual(["1"]);
    expect(filtrarUsuarios(lista, { ...FILTROS_VAZIOS, status: "pendente" }).map((u) => u.id)).toEqual(["3"]);
    expect(filtrarUsuarios(lista, { ...FILTROS_VAZIOS, busca: "angela" }).map((u) => u.id)).toEqual(["2"]);
    expect(filtrarUsuarios(lista, { ...FILTROS_VAZIOS, busca: "coordenadora" }).map((u) => u.id)).toEqual(["2"]);
    expect(filtrarUsuarios(lista, { ...FILTROS_VAZIOS, busca: "producao" }).map((u) => u.id)).toEqual(["1"]);
  });

  it("contador: grupo e status ligados; a busca não conta", () => {
    expect(filtrosAtivosDeUsuarios({ busca: "x", grupoId: "", status: "" })).toBe(0);
    expect(filtrosAtivosDeUsuarios({ busca: "", grupoId: "a", status: "ativo" })).toBe(2);
  });
});

describe("grupos", () => {
  const sistema = grupo({ id: "s", nome: "Administrador de sistema", sistema: true, nivel: null });
  const producao = grupo({ id: "p", nome: "Produção", nivel: "Producao", permissoes: [{ tela: "ordens.os", acao: "ver" }, { tela: "ordens.os", acao: "editar" }] });
  const leitura = grupo({ id: "l", nome: "Leitura", nivel: "Producao", permissoes: [{ tela: "ordens.os", acao: "ver" }] });
  const maior = grupo({ id: "m", nome: "Maior", nivel: "Producao", permissoes: [{ tela: "ordens.os", acao: "ver" }, { tela: "admin.logs", acao: "ver" }] });
  const financeiro = grupo({ id: "f", nome: "Financeiro", nivel: "Administrativo", permissoes: [{ tela: "ordens.os", acao: "ver" }] });
  const vazio = grupo({ id: "v", nome: "Vazio", nivel: "Producao", permissoes: [] });
  const inativo = grupo({ id: "i", nome: "Inativo", ativo: false });
  const todos = [sistema, producao, leitura, maior, financeiro, vazio, inativo];

  it("escolhíveis: só ativos; o de sistema só para quem é dele", () => {
    expect(gruposEscolheveis(todos, false).map((g) => g.id)).not.toContain("s");
    expect(gruposEscolheveis(todos, true).map((g) => g.id)[0]).toBe("s");
    expect(gruposEscolheveis(todos, true).map((g) => g.id)).not.toContain("i");
  });

  it("quem não é do Administrador só concede o próprio grupo, os menores e iguais, no mesmo nível", () => {
    const ids = gruposQuePossoConceder({ id: "p", sistema: false }, todos).map((g) => g.id);
    expect(ids).toContain("p");
    expect(ids).toContain("l");
    expect(ids).toContain("v");
    expect(ids).not.toContain("s");
    expect(ids).not.toContain("m");
    // Mesmas telas, nível que a Produção não contém.
    expect(ids).not.toContain("f");
  });

  it("Direção contém os outros níveis; o Administrador concede todos; sem grupo, nenhum", () => {
    const direcao = grupo({ id: "d", nivel: "Direcao", permissoes: [{ tela: "ordens.os", acao: "ver" }, { tela: "ordens.os", acao: "editar" }] });
    const ids = gruposQuePossoConceder({ id: "d", sistema: false }, [...todos, direcao]).map((g) => g.id);
    expect(ids).toContain("f");
    expect(ids).toContain("p");
    expect(gruposQuePossoConceder({ id: "s", sistema: true }, todos)).toHaveLength(todos.length);
    expect(gruposQuePossoConceder(null, todos)).toEqual([]);
  });

  it("semGrupoAlemDoSistema", () => {
    expect(semGrupoAlemDoSistema([sistema])).toBe(true);
    expect(semGrupoAlemDoSistema(todos)).toBe(false);
  });

  it("motivoDeNaoInativarGrupo diz quantos (singular e plural)", () => {
    expect(motivoDeNaoInativarGrupo(null)).toBeNull();
    expect(motivoDeNaoInativarGrupo(0)).toBeNull();
    expect(motivoDeNaoInativarGrupo(1)).toMatch(/1 usuário ativo/);
    expect(motivoDeNaoInativarGrupo(3)).toMatch(/3 usuários ativos/);
  });
});

describe("travas e ações da linha", () => {
  const tudo = () => true;
  const soVer = (_t: string, a: string) => a === "ver";
  const base = { ehEu: false, membroDoAdministrador: false, euSouAdministrador: false, grupoAtualConcedivel: true };

  it("motivoDeEdicaoTravada: o próprio acesso; membro do Administrador sem ser um", () => {
    expect(motivoDeEdicaoTravada({ ehEu: true, membroDoAdministrador: false, euSouAdministrador: false })).toMatch(/próprio acesso/);
    expect(motivoDeEdicaoTravada({ ehEu: false, membroDoAdministrador: true, euSouAdministrador: false })).toMatch(/Administrador de sistema/);
    expect(motivoDeEdicaoTravada({ ehEu: false, membroDoAdministrador: true, euSouAdministrador: true })).toBeNull();
  });

  it("ativo com inativar → inativar livre; olho sempre", () => {
    const a = acoesDaLinha({ status: "ativo" }, { ...base, pode: tudo });
    expect(a.ver).toBe("livre");
    expect(a.editar).toBe("livre");
    expect(a.alternar).toEqual({ tipo: "inativar", estado: "livre", escolherGrupo: false });
  });

  it("inativo → ativar livre e sem lápis; grupo atual que não serve pede o grupo", () => {
    const a = acoesDaLinha({ status: "inativo" }, { ...base, pode: tudo });
    expect(a.editar).toBe("oculto");
    expect(a.alternar?.tipo).toBe("ativar");
    expect(acoesDaLinha({ status: "inativo" }, { ...base, pode: tudo, grupoAtualConcedivel: false }).alternar?.escolherGrupo).toBe(true);
  });

  it("pendente → lápis e inativar", () => {
    const a = acoesDaLinha({ status: "pendente" }, { ...base, pode: tudo });
    expect(a.editar).toBe("livre");
    expect(a.alternar?.tipo).toBe("inativar");
  });

  it("sem editar o lápis some e o olho fica", () => {
    const a = acoesDaLinha({ status: "ativo" }, { ...base, pode: soVer });
    expect(a.editar).toBe("oculto");
    expect(a.ver).toBe("livre");
    expect(a.alternar).toBeNull();
  });

  it("a própria linha: lápis e inativar travados com o motivo, olho livre", () => {
    const a = acoesDaLinha({ status: "ativo" }, { ...base, ehEu: true, pode: tudo });
    expect(a.ver).toBe("livre");
    expect(a.editar).toBe("travado");
    expect(a.alternar?.estado).toBe("travado");
    expect(a.motivo).toMatch(/próprio acesso/);
  });
});

describe("setor e cargo: sugestões", () => {
  it("valores distintos, sem vazio, sem repetir por acento/caixa/espaço, em ordem", () => {
    expect(sugestoesDistintas(["Produção", " producao ", "", "Administrativo", "Produção"])).toEqual(["Administrativo", "Produção"]);
  });

  it("grava a grafia que já existe quando o digitado é o mesmo valor", () => {
    expect(grafiaExistente("producao", ["Produção"])).toBe("Produção");
    expect(grafiaExistente("  Novo   setor ", ["Produção"])).toBe("Novo setor");
    expect(grafiaExistente("   ", ["Produção"])).toBe("");
  });
});

describe("permissões específicas", () => {
  const catalogo = [
    { chave: "a.um", rotulo: "Um", descricao: "" },
    { chave: "a.dois", rotulo: "Dois", descricao: "" },
  ];

  it("segue a ordem do catálogo; a que quem edita não tem fica desabilitada com a dica", () => {
    const caixas = caixasDeEspeciais(catalogo, ["a.dois"], (c) => c === "a.um");
    expect(caixas.map((c) => c.chave)).toEqual(["a.um", "a.dois"]);
    expect(caixas[0].desabilitada).toBe(false);
    // O usuário tem "dois" e quem edita não: pode desmarcar.
    expect(caixas[1].desabilitada).toBe(false);
    expect(caixasDeEspeciais(catalogo, [], () => false)[1].dica).toMatch(/não pode concedê-la/);
    expect(caixasDeEspeciais(catalogo, [], () => true, true).every((c) => c.desabilitada && !c.dica)).toBe(true);
  });

  it("especiaisValidas e especiaisMudaram", () => {
    expect(especiaisValidas(catalogo, ["a.dois", "x", "a.dois"])).toEqual(["a.dois"]);
    expect(especiaisMudaram(["a", "b"], ["b", "a"])).toBe(false);
    expect(especiaisMudaram(["a"], ["a", "b"])).toBe(true);
  });
});
