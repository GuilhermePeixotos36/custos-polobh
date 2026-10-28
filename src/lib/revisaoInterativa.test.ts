import { describe, expect, it, vi } from "vitest";

// O revisor de verdade chama a IA no servidor: aqui ele é trocado por um falso.
const revisarCampos = vi.fn();
vi.mock("@/lib/correcaoOrtografica", async (original) => ({
  ...(await original<typeof import("@/lib/correcaoOrtografica")>()),
  revisarCampos: (...a: unknown[]) => revisarCampos(...a),
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { lembrarRevisados, pendentesDeRevisao, revisarPendentes, somenteMaiusculas } from "./revisaoInterativa";

const campo = (id: string, texto: string) => ({ id, texto });

describe("revisão perguntada: o que está pendente", () => {
  it("só os textos alterados desde a gravação", () => {
    const gravado = [campo("a", "texto igual"), campo("b", "antes")];
    const atual = [campo("a", "texto igual"), campo("b", "depois"), campo("c", "novo")];
    expect(pendentesDeRevisao(atual, gravado, new Map()).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("o que já foi revisado não pergunta de novo — até ser reescrito", () => {
    const gravado = [campo("b", "antes")];
    const revisados = lembrarRevisados(new Map(), [campo("b", "profssiinal")], new Map([["b", "Profissional"]]));
    expect(pendentesDeRevisao([campo("b", "Profissional")], gravado, revisados)).toHaveLength(0);
    expect(pendentesDeRevisao([campo("b", "Profissional mudado")], gravado, revisados)).toHaveLength(1);
  });

  it("sem revisão, vale só a regra de maiúsculas", () => {
    expect(somenteMaiusculas([campo("a", "saguão")]).get("a")).toBe("Saguão");
  });
});

describe("revisão perguntada: quando a IA falha", () => {
  it("avisa a falha e devolve o texto só com maiúsculas", async () => {
    revisarCampos.mockResolvedValueOnce({ textos: new Map(), revisaoCompleta: false });
    const r = await revisarPendentes([campo("a", "profssiinal")]);
    expect(r.falhou).toBe(true);
    expect(r.textos.get("a")).toBe("Profssiinal");
  });

  it("erro inesperado também conta como falha, sem derrubar o salvamento", async () => {
    revisarCampos.mockRejectedValueOnce(new Error("rede"));
    const r = await revisarPendentes([campo("a", "texto")]);
    expect(r.falhou).toBe(true);
  });

  it("com a IA respondendo, usa o texto revisado", async () => {
    revisarCampos.mockResolvedValueOnce({ textos: new Map([["a", "Profissional"]]), revisaoCompleta: true });
    const r = await revisarPendentes([campo("a", "profssiinal")]);
    expect(r).toEqual({ textos: new Map([["a", "Profissional"]]), falhou: false });
  });
});
