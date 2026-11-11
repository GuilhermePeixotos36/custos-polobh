/**
 * "Ativar avisos" nunca fica mudo (11/11/2026): cada resposta possível do
 * navegador vira um resultado que a tela explica — e o estado do push só diz
 * "ativo" quando o servidor de fato registrou o aparelho.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invocar = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invocar(...a) }, rpc: vi.fn(), from: vi.fn() },
}));

import { ativarAvisos, pushAtivoNesteAparelho, usePushEstado } from "./push";

/** Um navegador de mentira: permissão, serviço de avisos e inscrição. */
function navegador(o: { permissao: NotificationPermission; aoPedir?: NotificationPermission; subscribe?: () => Promise<unknown> }) {
  const inscricao = {
    endpoint: "https://push.exemplo/abc",
    getKey: () => new Uint8Array([1, 2, 3]).buffer,
  };
  const registro = {
    pushManager: {
      getSubscription: async () => null,
      subscribe: o.subscribe ?? (async () => inscricao),
    },
  };
  class Notif {
    static permission = o.permissao;
    static async requestPermission() {
      Notif.permission = o.aoPedir ?? o.permissao;
      return Notif.permission;
    }
  }
  Object.defineProperty(window, "Notification", { value: Notif, configurable: true });
  Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: async () => registro, ready: Promise.resolve(registro) },
    configurable: true,
  });
}

beforeEach(() => {
  invocar.mockReset();
  invocar.mockImplementation(async (_nome: string, { body }: { body: { acao: string } }) => ({
    data: body.acao === "chave" ? { ok: true, chave: "BAzKIiGciVx32gBVOyrV7B4npuQ_TRgTGma6fcUSCaIqsZffOc23hfu2EGE7JpR2kDac8L2upZg_aJgjAbSqGiQ" } : { ok: true },
    error: null,
  }));
  usePushEstado.setState({ estado: "inativo", erro: "" });
});

describe("Ativar avisos", () => {
  it("permissão bloqueada no navegador: 'negada', e nada é registrado", async () => {
    navegador({ permissao: "denied" });
    expect(await ativarAvisos([])).toBe("negada");
    expect(pushAtivoNesteAparelho()).toBe(false);
    expect(invocar).not.toHaveBeenCalled();
  });

  it("pedido fechado sem escolha: 'ignorada'", async () => {
    navegador({ permissao: "default", aoPedir: "default" });
    expect(await ativarAvisos([])).toBe("ignorada");
    expect(pushAtivoNesteAparelho()).toBe(false);
  });

  it("permitiu e o servidor registrou: 'ativo'", async () => {
    navegador({ permissao: "default", aoPedir: "granted" });
    expect(await ativarAvisos(["p1", "p2"])).toBe("ativo");
    expect(pushAtivoNesteAparelho()).toBe(true);
    const inscrever = invocar.mock.calls.map((c) => c[1].body).find((b) => b.acao === "inscrever");
    expect(inscrever.ids).toEqual(["p1", "p2"]);
    expect(inscrever.inscricao.endpoint).toBe("https://push.exemplo/abc");
  });

  it("permitiu, mas o aparelho não conseguiu se registrar: 'falhou', com o motivo visível", async () => {
    navegador({ permissao: "granted", subscribe: async () => { throw new Error("Registration failed - push service error"); } });
    expect(await ativarAvisos([])).toBe("falhou");
    expect(pushAtivoNesteAparelho()).toBe(false);
    expect(usePushEstado.getState()).toEqual({ estado: "falhou", erro: "Registration failed - push service error" });
  });

  it("o servidor recusa o registro: 'falhou', e nunca 'ativo'", async () => {
    navegador({ permissao: "granted" });
    invocar.mockImplementation(async (_n: string, { body }: { body: { acao: string } }) =>
      body.acao === "chave" ? { data: { ok: true, chave: "BAzKIiGciVx32gBVOyrV7B4npuQ_TRgTGma6fcUSCaIqsZffOc23hfu2EGE7JpR2kDac8L2upZg_aJgjAbSqGiQ" }, error: null } : { data: { ok: false, erro: "Sem permissão" }, error: null }
    );
    expect(await ativarAvisos([])).toBe("falhou");
    expect(usePushEstado.getState().estado).toBe("falhou");
    expect(usePushEstado.getState().erro).toBe("Sem permissão");
  });
});
