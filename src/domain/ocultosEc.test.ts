import { describe, expect, it } from "vitest";
import { grupoVisivel, ocultarTudo, ocultosPorGrupo, reexibirItens, totalOcultos } from "./ocultosEc";

const l = (id: string, grupo: string, item: string, oculto = false) => ({ id, grupo, item, descricao: "", oculto });

describe("ocultar e reexibir na EC", () => {
  const linhas = [l("1", "A", "Palco"), l("2", "A", "Som", true), l("3", "B", "Buffet", true), l("4", "B", "Água", true)];

  it("grupo some quando TODOS os itens estão ocultos; com algum visível, fica", () => {
    expect(grupoVisivel([{ oculto: false }, { oculto: true }])).toBe(true);
    expect(grupoVisivel([{ oculto: true }, { oculto: true }])).toBe(false);
    expect(grupoVisivel([])).toBe(true);
  });

  it("ocultar tudo oculta o que já existe — e nada além", () => {
    const r = ocultarTudo(linhas);
    expect(r.every((x) => x.oculto)).toBe(true);
    expect(r).toHaveLength(4);
    // o que nasce depois é visível
    expect(grupoVisivel([...r, { oculto: false }])).toBe(true);
  });

  it("lista o que está oculto por grupo, marcando o grupo inteiro oculto", () => {
    expect(ocultosPorGrupo(linhas)).toEqual([
      { grupo: "A", inteiro: false, itens: [{ id: "2", titulo: "Som" }] },
      { grupo: "B", inteiro: true, itens: [{ id: "3", titulo: "Buffet" }, { id: "4", titulo: "Água" }] },
    ]);
  });

  it("reexibe só os escolhidos e mantém a ordem", () => {
    const r = reexibirItens(linhas, ["3"]);
    expect(r.map((x) => x.oculto)).toEqual([false, true, false, true]);
    expect(r.map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    expect(totalOcultos(r)).toBe(2);
  });

  it("item sem título usa a descrição, ou um nome padrão", () => {
    const r = ocultosPorGrupo([
      { id: "x", grupo: "G", item: "", descricao: "Detalhe", oculto: true },
      { id: "y", grupo: "G", item: "", descricao: "", oculto: true },
    ]);
    expect(r[0].itens.map((i) => i.titulo)).toEqual(["Detalhe", "(item sem título)"]);
  });
});
