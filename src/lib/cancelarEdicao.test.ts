import { describe, expect, it, vi } from "vitest";

const { confirmar } = vi.hoisted(() => ({ confirmar: vi.fn(async (..._a: unknown[]) => false) }));
vi.mock("@/store/confirm", () => ({ confirmar }));

import { podeDescartar } from "./cancelarEdicao";

describe("cancelar edição", () => {
  it("sem alteração, sai direto sem perguntar", async () => {
    expect(await podeDescartar(false)).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("com alteração, pergunta — e respeita o 'continuar editando'", async () => {
    expect(await podeDescartar(true)).toBe(false);
    expect(confirmar).toHaveBeenCalledOnce();
  });
});
