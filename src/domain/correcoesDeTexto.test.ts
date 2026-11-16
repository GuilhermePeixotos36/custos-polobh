import { describe, expect, it } from "vitest";
import { correcoesDaRevisao } from "./correcoesDeTexto";

describe("correcoesDaRevisao", () => {
  it("lista cada palavra corrigida, antes → depois", () => {
    expect(correcoesDaRevisao("A execusão do servico e obrigatoria.", "A execução do serviço é obrigatória.")).toEqual([
      { de: "execusão", para: "execução" },
      { de: "servico e obrigatoria.", para: "serviço é obrigatória." },
    ]);
  });

  it("ignora marcas de formatação, recuo e bullets: só as palavras contam", () => {
    expect(correcoesDaRevisao("- **Parágrafo Único** sem acentuacao.", ">> - **Parágrafo Único** sem acentuação.")).toEqual([
      { de: "acentuacao.", para: "acentuação." },
    ]);
  });

  it("palavra acrescentada ou retirada aparece de um lado só", () => {
    expect(correcoesDaRevisao("Fica eleito foro.", "Fica eleito o foro.")).toEqual([{ de: "", para: "o" }]);
    expect(correcoesDaRevisao("Fica eleito o o foro.", "Fica eleito o foro.")).toEqual([{ de: "o", para: "" }]);
  });

  it("sem diferença não devolve nada", () => {
    expect(correcoesDaRevisao("Igual.\n- Item", "Igual.\n- Item")).toEqual([]);
  });
});
