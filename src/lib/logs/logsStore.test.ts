import { beforeEach, describe, expect, it, vi } from "vitest";

// A consulta fala com o banco pelo cliente; aqui ele é um falso controlado por cada teste.
const rpc = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import {
  buscaSeguraParaOr, coletarParaExportar, consultarLogs, filtrosAtivos, filtrosIniciais, itemDaTrilhaAntiga, limitarPeriodo,
  opcoesDeTela, parametrosDaConsulta, periodoPadrao, rotuloDaAcao, rotuloDaTela, semFiltrosDoPainel, LogsIndisponiveis,
  type Consultar, type ItemLog,
} from "./logsStore";

beforeEach(() => rpc.mockReset());

describe("filtros", () => {
  it("padrão: últimos 7 dias, hoje incluído, página 1, mais novo primeiro", () => {
    expect(periodoPadrao("2026-03-10")).toEqual({ inicio: "2026-03-04", fim: "2026-03-10" });
    const f = filtrosIniciais("2026-03-10");
    expect(f).toMatchObject({ aba: "atividades", pagina: 1, ordem: "em_desc", inicio: "2026-03-04" });
  });

  it("parametrosDaConsulta: o dia vai de 00:00 a 23:59:59.999 em Brasília; filtro vazio nem entra", () => {
    const p = parametrosDaConsulta(filtrosIniciais("2026-03-10"));
    expect(p.de).toBe("2026-03-04T00:00:00-03:00");
    expect(p.ate).toBe("2026-03-10T23:59:59.999-03:00");
    for (const chave of ["usuarioId", "nivel", "resultado", "tela", "telas", "origem", "busca", "correlacao"]) {
      expect(p[chave]).toBeUndefined();
    }
  });

  it("o filtro de tela vai em `tela` (casa sub-rota no banco) e em `telas`", () => {
    const p = parametrosDaConsulta({ ...filtrosIniciais("2026-03-10"), tela: "/projetos" });
    expect(p.tela).toBe("/projetos");
    expect(p.telas).toEqual(["/projetos"]);
  });

  it("período acima de 90 dias é recortado pelo fim", () => {
    expect(limitarPeriodo("2025-01-01", "2026-03-10")).toEqual({ inicio: "2025-12-11", fim: "2026-03-10" });
    expect(limitarPeriodo("2026-03-01", "2026-03-10")).toEqual({ inicio: "2026-03-01", fim: "2026-03-10" });
  });

  it("filtrosAtivos conta só os do painel; limpar o painel mantém período e busca", () => {
    const f = { ...filtrosIniciais("2026-03-10"), busca: "x", nivel: "erro", tela: "/ordens", pagina: 3 };
    expect(filtrosAtivos(f)).toBe(2);
    const limpo = semFiltrosDoPainel(f);
    expect(filtrosAtivos(limpo)).toBe(0);
    expect(limpo).toMatchObject({ busca: "x", inicio: f.inicio, fim: f.fim, pagina: 1 });
  });
});

describe("rótulos", () => {
  it("ação conhecida tem rótulo (inclusive as da trilha antiga); desconhecida volta como a chave", () => {
    expect(rotuloDaAcao("login")).toBe("Entrou no app");
    expect(rotuloDaAcao("auth.login")).toBe("Entrou no app");
    expect(rotuloDaAcao("ec.excel")).toBe("ec.excel");
  });

  it("rotuloDaTela: caminho conhecido, caminho filho e texto solto", () => {
    expect(rotuloDaTela("/projetos")).toBe("Projetos");
    expect(rotuloDaTela("/projetos/abc-123")).toBe("Projetos");
    expect(rotuloDaTela("edge/backup")).toBe("edge/backup");
    expect(rotuloDaTela(null)).toBe("");
  });

  it("opcoesDeTela: cada rota uma vez, em ordem alfabética", () => {
    const opcoes = opcoesDeTela([{ valor: "/b", rotulo: "Beta" }, { valor: "/a", rotulo: "Alfa" }, { valor: "/b", rotulo: "Beta" }]);
    expect(opcoes.map((o) => o.valor)).toEqual(["/a", "/b"]);
  });
});

describe("consultarLogs", () => {
  it("auditoriaIncluida só passa adiante quando é boolean", async () => {
    rpc.mockResolvedValueOnce({ data: { total: 1, itens: [], auditoriaIncluida: null }, error: null });
    expect((await consultarLogs(filtrosIniciais("2026-03-10"))).auditoriaIncluida).toBeUndefined();
    rpc.mockResolvedValueOnce({ data: { total: 1, itens: [], auditoriaIncluida: false }, error: null });
    expect((await consultarLogs(filtrosIniciais("2026-03-10"))).auditoriaIncluida).toBe(false);
  });

  it("função ausente (migration pendente) vira LogsIndisponiveis; 42501 traz a mensagem do banco", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    await expect(consultarLogs(filtrosIniciais("2026-03-10"))).rejects.toBeInstanceOf(LogsIndisponiveis);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Você não tem permissão para ver os logs." } });
    await expect(consultarLogs(filtrosIniciais("2026-03-10"))).rejects.toThrow("Você não tem permissão para ver os logs.");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "detalhe técnico" } });
    await expect(consultarLogs(filtrosIniciais("2026-03-10"))).rejects.toThrow("Não foi possível carregar os logs.");
  });
});

describe("trilha antiga (reserva sem a migration)", () => {
  it("a busca perde o que muda o sentido do filtro or(...) do PostgREST", () => {
    expect(buscaSeguraParaOr('a,b) or(x.eq.1)*"%_')).toBe("a b or x.eq.1");
  });

  it("mapeia a linha da audit_log no formato da tela", () => {
    const item = itemDaTrilhaAntiga({
      id: "u1", ts: "2026-03-10T12:00:00Z", nivel: "aviso", categoria: "Acesso", acao: "acesso.negado",
      mensagem: "Acesso negado", usuario: "Pessoa Teste", papel: "Producao", user_id: null, alvo_id: null,
    }, "acessos");
    expect(item).toMatchObject({ id: "auditoria:u1", fonte: "auditoria", categoria: "acesso", resultado: "negado", origem: "app", alvoTipo: "Acesso" });
    expect(item.detalhe).toEqual({ categoria: "Acesso", papel: "Producao" });
  });
});

describe("coletarParaExportar", () => {
  const item = (n: number): ItemLog => ({
    id: `log:${n}`, fonte: "log", em: "2026-03-10T12:00:00Z", categoria: "erro", nivel: "erro", acao: "erro_js", resultado: "falha",
    atorId: null, atorNome: null, alvoTipo: null, alvoId: null, alvoRotulo: null, tela: null, origem: "app", mensagem: null,
    detalhe: null, ip: null, userAgent: null, correlacao: null,
  });
  const falso = (total: number): Consultar => async (f, porPagina = 50) => {
    const inicio = (f.pagina - 1) * porPagina;
    const fim = Math.min(total, inicio + porPagina);
    return { total, itens: Array.from({ length: Math.max(0, fim - inicio) }, (_, i) => item(inicio + i)) };
  };

  it("junta as páginas de 200 em 200", async () => {
    const r = await coletarParaExportar(filtrosIniciais("2026-03-10"), falso(450));
    expect(r.itens).toHaveLength(450);
    expect(r.cortou).toBe(false);
  });

  it("para no teto e devolve cortou quando o total passa dele", async () => {
    const r = await coletarParaExportar(filtrosIniciais("2026-03-10"), falso(1000), 300);
    expect(r.itens).toHaveLength(300);
    expect(r).toMatchObject({ total: 1000, cortou: true });
  });
});
