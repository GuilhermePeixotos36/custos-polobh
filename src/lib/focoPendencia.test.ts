import { afterEach, describe, expect, it, vi } from "vitest";

// O destaque mexe no DOM (rolar, piscar); aqui só interessa quem abre o quê.
vi.mock("@/lib/destaque", () => ({
  destacarElemento: vi.fn(),
  idAncoraPendencia: (id: string) => `pendencia-${id}`,
  idCampoPendencia: (a: string, c: string) => `pendencia-campo-${a}-${c}`,
  idComentario: (id: string) => `comentario-${id}`,
}));

import { alvoPendente, aoFocarPendencia, focarPendencia, haAlvoPendente } from "./focoPendencia";

/**
 * O caminho da gaveta de Observações (24/11/2026): a conversa saiu do corpo da tela e foi para
 * uma gaveta no cabeçalho. A pílula e o sininho continuam saltando para a observação, e a regra
 * que segura isso é esta — a gaveta ABRE (ouvinte que devolve `false`), a thread ATENDE.
 */
describe("salto para uma observação da gaveta", () => {
  const limpar: (() => void)[] = [];
  afterEach(() => {
    limpar.splice(0).forEach((f) => f());
    alvoPendente("ec-geral:1"); // consome o que sobrou
  });

  it("a gaveta é avisada do salto para a sua conversa, e não da dos outros", () => {
    const abriu: string[] = [];
    limpar.push(aoFocarPendencia((alvo) => {
      if (alvo.ancora === "ec-geral:1") abriu.push(alvo.observacaoId ?? "");
      return false;
    }));
    focarPendencia({ ancora: "outra", observacaoId: "x" });
    focarPendencia({ ancora: "ec-geral:1", observacaoId: "obs-7" });
    expect(abriu).toEqual(["obs-7"]);
  });

  it("a gaveta abrir não consome o salto: sem thread montada, ele fica guardado para ela", () => {
    limpar.push(aoFocarPendencia(() => false)); // a gaveta: abre e devolve false
    focarPendencia({ ancora: "ec-geral:1", observacaoId: "obs-7" });
    // A gaveta espia no render (nasce aberta)…
    expect(haAlvoPendente("ec-geral:1")).toBe(true);
    // …espiar não consome: a thread, ao montar, ainda recebe o comentário exato.
    expect(alvoPendente("ec-geral:1")).toEqual({ ancora: "ec-geral:1", observacaoId: "obs-7", campos: undefined });
    expect(haAlvoPendente("ec-geral:1")).toBe(false);
  });

  it("com a thread montada (ela atende), nada fica pendurado", () => {
    limpar.push(aoFocarPendencia(() => false));
    limpar.push(aoFocarPendencia((alvo) => alvo.ancora === "ec-geral:1"));
    focarPendencia({ ancora: "ec-geral:1", observacaoId: "obs-7" });
    expect(haAlvoPendente("ec-geral:1")).toBe(false);
  });

  it("o espiar é por âncora: o salto de outra conversa não abre esta gaveta", () => {
    focarPendencia({ ancora: "projeto-conversa:p:checklist", observacaoId: "o1" });
    expect(haAlvoPendente("projeto-conversa:p:dados")).toBe(false);
    expect(haAlvoPendente("projeto-conversa:p:checklist")).toBe(true);
    alvoPendente("projeto-conversa:p:checklist");
  });
});
