import { beforeEach, describe, expect, it, vi } from "vitest";

const { flags, confirmar } = vi.hoisted(() => ({
  flags: { disparoFornecedor: false, emailDestinoReal: false },
  confirmar: vi.fn(async (..._a: unknown[]) => true),
}));
vi.mock("@/lib/flags", () => ({ flags }));
vi.mock("@/store/confirm", () => ({ confirmar }));

import { disparoBloqueado, notaCaixaDeTeste } from "./avisoHomologacao";

describe("aviso de homologação só na hora do envio", () => {
  beforeEach(() => {
    confirmar.mockClear();
    flags.disparoFornecedor = false;
    flags.emailDestinoReal = false;
  });

  it("disparo desligado: mostra o aviso e para o envio", async () => {
    expect(await disparoBloqueado("a OS")).toBe(true);
    expect(confirmar).toHaveBeenCalledOnce();
    expect(JSON.stringify(confirmar.mock.calls[0])).toContain("envio da OS");
  });

  it("disparo ligado: segue sem aviso", async () => {
    flags.disparoFornecedor = true;
    expect(await disparoBloqueado("o cronograma")).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("e-mail desviado: a confirmação ganha a nota da caixa de teste; liberado, não", () => {
    expect(notaCaixaDeTeste()).toContain("caixa de teste");
    flags.emailDestinoReal = true;
    expect(notaCaixaDeTeste()).toBe("");
  });
});
