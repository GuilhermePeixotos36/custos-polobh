// O teste que teria pego a tela em branco do DP Corp: carrega o registrador e o módulo do cliente
// nas duas ordens, sem nenhum dos dois ler o outro no carregamento. Não substitui abrir o app em
// build de produção — prova que os módulos não se leem na carga, não que o bundle carrega.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  // O cliente falha cedo sem as variáveis; aqui elas só precisam existir (nada é chamado).
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "chave-de-teste");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ordem de importação", () => {
  it("registrarLog sozinho carrega sem tocar no cliente, e registrar não faz nada", async () => {
    const log = await import("./registrarLog");
    expect(log.registroConfigurado()).toBe(false);
    expect(() => log.registrarLog({ categoria: "erro", acao: "erro_js", mensagem: "x" })).not.toThrow();
    expect(() => log.registrarFalhaDeLogin("alguem@exemplo.com")).not.toThrow();
  });

  it("cliente primeiro: ele injeta o enviador no registrarLog", async () => {
    const cliente = await import("@/lib/supabaseClient");
    const log = await import("./registrarLog");
    expect(cliente.supabase).toBeDefined();
    expect(log.registroConfigurado()).toBe(true);
  });

  it("registrarLog primeiro, depois o cliente: o mesmo resultado", async () => {
    const log = await import("./registrarLog");
    expect(log.registroConfigurado()).toBe(false);
    await import("@/lib/supabaseClient");
    expect(log.registroConfigurado()).toBe(true);
  });

  it("só as seis ações do app passam", async () => {
    const { ACOES_DO_APP, prepararEvento } = await import("./registrarLog");
    expect([...ACOES_DO_APP].sort()).toEqual(["acesso_negado", "erro_js", "erro_requisicao", "exportacao", "login", "logout"]);
    expect(prepararEvento({ categoria: "atividade", acao: "usuario_criado" })).toBeNull();
  });
});
