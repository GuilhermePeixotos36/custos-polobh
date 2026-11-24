/**
 * Catálogo e regras de permissão (padrão de Acessos LSPRO, testes.md bloco 1).
 * As rotas autenticadas saem do próprio `router.tsx`, não de uma lista digitada aqui.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO, RECURSO_POR_PERMISSAO, PERMISSOES_ESPECIAIS, CHAVE_ESPECIAL_VALIDA } from "@/config/acessos/catalogo";
import {
  acoesDaTela, alternarAcao, alternarModulo, colunaMarcada, colunasDoModulo, marcarColuna, marcarModulo, moduloVisivel,
  permissoesDosRecursos, permissoesValidas, pode, podeVerRota, recursosDasPermissoes, resumoDoGrupo, somenteLeitura,
  telasDaRota, temEscrita, todasAsPermissoes, type Permissao,
} from "./permissoes";

const TELAS = CATALOGO.flatMap((m) => m.telas);

/**
 * As rotas filhas da casca autenticada (`path: "/"` em router.tsx), com a barra na frente. O
 * caminho sai da raiz do repositório (onde o vitest roda): no jsdom, `import.meta.url` não é file:.
 */
function rotasAutenticadas(): string[] {
  const arquivo = readFileSync(resolve(process.cwd(), "src/router.tsx"), "utf8");
  const bloco = arquivo.slice(arquivo.indexOf("children: ["), arquivo.indexOf('{ path: "*"'));
  return [...bloco.matchAll(/path: "([^"]+)"/g)].map((m) => `/${m[1]}`);
}

// Rotas que não são tela: só redirecionam (a antiga lista de estimativas manda para Projetos).
const ROTAS_LIVRES = new Set(["/estimativas"]);

describe("catálogo", () => {
  it("toda rota autenticada cai em alguma tela", () => {
    const rotas = rotasAutenticadas();
    expect(rotas.length).toBeGreaterThan(10);
    expect(rotas).toContain("/acessos");
    const semTela = rotas.filter((r) => !ROTAS_LIVRES.has(r) && telasDaRota(r.replace(/:[a-zA-Z]+/g, "x")).length === 0);
    expect(semTela).toEqual([]);
  });

  it("chave de tela não se repete; toda tela tem ver; extra não repete ação padrão", () => {
    const chaves = TELAS.map((t) => t.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const tela of TELAS) {
      expect(tela.acoes, tela.chave).toContain("ver");
      for (const extra of tela.extras ?? []) expect(["ver", "criar", "editar", "inativar"]).not.toContain(extra.chave);
    }
  });

  it("chaves no formato que o banco aceita", () => {
    for (const tela of TELAS) {
      expect(tela.chave).toMatch(/^[a-z0-9_.-]+$/);
      for (const acao of acoesDaTela(tela)) expect(acao).toMatch(/^[a-z_]+$/);
    }
  });

  it("as duas telas de Acessos existem com as chaves fixas do padrão", () => {
    expect(TELAS.find((t) => t.chave === "acessos.usuarios")?.rotas).toEqual(["/acessos"]);
    expect(TELAS.find((t) => t.chave === "acessos.grupos")?.rotas).toEqual(["/acessos"]);
  });

  it("cada recurso antigo aponta para uma ação que existe no catálogo, um para um", () => {
    const vistos = new Set<string>();
    for (const m of RECURSO_POR_PERMISSAO) {
      const tela = TELAS.find((t) => t.chave === m.tela);
      expect(tela, m.recurso).toBeDefined();
      expect(acoesDaTela(tela!), m.recurso).toContain(m.acao);
      expect(vistos.has(`${m.tela}|${m.acao}`), m.recurso).toBe(false);
      vistos.add(`${m.tela}|${m.acao}`);
    }
    expect(new Set(RECURSO_POR_PERMISSAO.map((m) => m.recurso)).size).toBe(RECURSO_POR_PERMISSAO.length);
  });

  it("permissões específicas: a Pólobh não tem nenhuma, e as que vierem seguem o formato", () => {
    for (const p of PERMISSOES_ESPECIAIS) expect(p.chave).toMatch(CHAVE_ESPECIAL_VALIDA);
    expect(PERMISSOES_ESPECIAIS).toEqual([]);
  });
});

describe("rota → tela", () => {
  it("rota filha cai na tela da mãe; prefixo parecido não casa", () => {
    expect(telasDaRota("/fornecedores/123").map((t) => t.chave)).toEqual(["cadastros.fornecedores"]);
    expect(telasDaRota("/fornecedoresx")).toEqual([]);
  });

  it("/acessos vale para quem vê usuários OU grupos", () => {
    expect(podeVerRota([{ tela: "acessos.grupos", acao: "ver" }], "/acessos")).toBe(true);
    expect(podeVerRota([{ tela: "acessos.usuarios", acao: "ver" }], "/acessos")).toBe(true);
    expect(podeVerRota([{ tela: "admin.logs", acao: "ver" }], "/acessos")).toBe(false);
  });

  it("rota livre é de todo mundo; sem ver não entra", () => {
    expect(podeVerRota([], "/")).toBe(true);
    expect(podeVerRota([], "/logs")).toBe(false);
    expect(podeVerRota([{ tela: "admin.logs", acao: "ver" }], "/logs")).toBe(true);
  });
});

describe("pode, escrita e somente leitura", () => {
  const soVerEc: Permissao[] = [{ tela: "estimativas.ec", acao: "ver" }, { tela: "estimativas.ec", acao: "ver_valores" }];

  it("pode confere tela e ação; ver_valores não é escrita", () => {
    expect(pode(soVerEc, "estimativas.ec", "ver")).toBe(true);
    expect(pode(soVerEc, "estimativas.ec", "editar")).toBe(false);
    expect(temEscrita(soVerEc, "estimativas.ec")).toBe(false);
    expect(temEscrita([{ tela: "estimativas.ec", acao: "editar" }], "estimativas.ec")).toBe(true);
  });

  it("vê e não escreve → somente leitura; rota livre e sem acesso → não", () => {
    expect(somenteLeitura([{ tela: "cadastros.fornecedores", acao: "ver" }], "/fornecedores")).toBe(true);
    expect(somenteLeitura([], "/")).toBe(false);
    expect(somenteLeitura([], "/fornecedores")).toBe(false);
  });

  it("tela só de Ver (Logs, Configurações) nunca mostra a faixa: ver é usar", () => {
    expect(somenteLeitura([{ tela: "admin.logs", acao: "ver" }], "/logs")).toBe(false);
    expect(somenteLeitura([{ tela: "admin.configuracoes", acao: "ver" }], "/configuracoes")).toBe(false);
  });

  it("quem edita o bloco de dentro não vê a faixa na página que o hospeda", () => {
    // A Coordenação Administrativo-Financeira vê o projeto sem editá-lo, mas edita o check-list dele.
    const coordenacao: Permissao[] = [
      { tela: "projetos.projetos", acao: "ver" },
      { tela: "projetos.checklists", acao: "ver" }, { tela: "projetos.checklists", acao: "editar" },
      { tela: "estimativas.ec", acao: "ver" },
      { tela: "ordens.os", acao: "ver" }, { tela: "ordens.os", acao: "editar" },
    ];
    expect(somenteLeitura(coordenacao, "/projetos/1")).toBe(false);
    expect(somenteLeitura(coordenacao, "/estimativas/1/os/nova")).toBe(false);
  });
});

describe("regra do Ver e matriz", () => {
  it("marcar uma ação marca o Ver; desmarcar o Ver limpa a linha; desmarcar outra mantém o Ver", () => {
    const comEditar = alternarAcao([], "ordens.os", "editar", true);
    expect(comEditar).toEqual([{ tela: "ordens.os", acao: "ver" }, { tela: "ordens.os", acao: "editar" }]);
    expect(alternarAcao(comEditar, "ordens.os", "ver", false)).toEqual([]);
    expect(alternarAcao(comEditar, "ordens.os", "editar", false)).toEqual([{ tela: "ordens.os", acao: "ver" }]);
  });

  it("não repete e ignora ação que a tela não tem", () => {
    const uma = alternarAcao([], "admin.logs", "ver", true);
    expect(alternarAcao(uma, "admin.logs", "ver", true)).toEqual(uma);
    expect(alternarAcao([], "admin.logs", "editar", true)).toEqual([]);
  });

  it("desligar o módulo tira só as dele; ligar não concede nada", () => {
    const base: Permissao[] = [{ tela: "admin.logs", acao: "ver" }, { tela: "cadastros.fornecedores", acao: "ver" }];
    expect(alternarModulo(base, "admin", false)).toEqual([{ tela: "cadastros.fornecedores", acao: "ver" }]);
    expect(alternarModulo([], "admin", true)).toEqual([]);
  });

  it("coluna marca só as telas que têm a ação; marcar tudo e limpar", () => {
    const coluna = marcarColuna([], "ordens", "emitir", true);
    expect(coluna).toEqual([{ tela: "ordens.os", acao: "ver" }, { tela: "ordens.os", acao: "emitir" }]);
    expect(colunaMarcada(coluna, "ordens", "emitir")).toBe(true);
    const tudo = marcarModulo([], "ordens", true);
    expect(tudo.length).toBe(todasAsPermissoes("ordens").length);
    expect(marcarModulo(tudo, "ordens", false)).toEqual([]);
  });

  it("módulo só é visível com alguma tela vista", () => {
    expect(moduloVisivel([], "admin")).toBe(false);
    expect(moduloVisivel([{ tela: "admin.logs", acao: "ver" }], "admin")).toBe(true);
  });

  it("colunas do módulo: as quatro fixas e as extras sem repetir", () => {
    const ordens = CATALOGO.find((m) => m.id === "ordens")!;
    const colunas = colunasDoModulo(ordens).map((c) => c.chave);
    expect(colunas.slice(0, 4)).toEqual(["ver", "criar", "editar", "inativar"]);
    expect(new Set(colunas).size).toBe(colunas.length);
  });
});

describe("resumo e validação", () => {
  it("resumoDoGrupo", () => {
    expect(resumoDoGrupo([])).toBe("Nenhuma tela");
    expect(resumoDoGrupo([{ tela: "admin.logs", acao: "ver" }])).toBe("1 tela em 1 módulo");
    expect(resumoDoGrupo([{ tela: "admin.logs", acao: "ver" }, { tela: "ordens.os", acao: "ver" }])).toBe("2 telas em 2 módulos");
  });

  it("permissoesValidas descarta fora do catálogo, tira repetidas e completa o Ver", () => {
    expect(permissoesValidas([
      { tela: "inexistente", acao: "ver" },
      { tela: "ordens.os", acao: "emitir" },
      { tela: "ordens.os", acao: "emitir" },
    ])).toEqual([{ tela: "ordens.os", acao: "emitir" }, { tela: "ordens.os", acao: "ver" }]);
  });

  it("o grupo de sistema inteiro passa sem perder nada", () => {
    expect(permissoesValidas(todasAsPermissoes()).length).toBe(todasAsPermissoes().length);
  });
});

describe("ponte com os recursos antigos", () => {
  it("permissões → recursos e de volta, sem perder nada (fora Acessos no modo de compatibilidade)", () => {
    const recursos = ["projetos", "projetos.editar", "oss", "oss.financeiro", "oss.financeiro.editar", "checklists.padrao", "checklists"];
    const ida = permissoesDosRecursos(recursos);
    expect(recursosDasPermissoes(ida).sort()).toEqual([...recursos].sort());
    expect(permissoesDosRecursos(["acessos.usuarios"])).toEqual([]);
  });

  it("grupo de sistema libera todos os recursos mapeados", () => {
    expect(recursosDasPermissoes(todasAsPermissoes()).length).toBe(RECURSO_POR_PERMISSAO.length);
  });
});
