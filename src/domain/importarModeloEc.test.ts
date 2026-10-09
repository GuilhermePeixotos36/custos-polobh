import { describe, expect, it } from "vitest";
import {
  alternarGrupo,
  alternarItem,
  gruposDaModalidade,
  gruposDoModelo,
  montarImportacao,
  selecaoVazia,
} from "./importarModeloEc";

const modelo = [
  { grupo: "A", item: "a1", descricao: "da1" },
  { grupo: "A", item: "a2", descricao: "da2" },
  { grupo: "B", item: "b1", descricao: "db1" },
  { grupo: "A", item: "a1", descricao: "repetido" },
];
const grupos = gruposDoModelo(modelo);

describe("importar modelo na EC", () => {
  it("agrupa pela ordem de aparição e distingue itens de mesmo nome", () => {
    expect(grupos.map((g) => g.nome)).toEqual(["A", "B"]);
    const chaves = grupos[0].itens.map((i) => i.chave);
    expect(new Set(chaves).size).toBe(3);
  });

  it("marcar o grupo traz todos os itens", () => {
    const sel = alternarGrupo(selecaoVazia(), grupos[0], true);
    expect(montarImportacao(grupos, sel).map((e) => e.item)).toEqual(["a1", "a2", "a1"]);
  });

  it("dá para desmarcar um item solto", () => {
    let sel = alternarGrupo(selecaoVazia(), grupos[0], true);
    sel = alternarItem(sel, grupos[0], grupos[0].itens[1].chave, false);
    expect(montarImportacao(grupos, sel).map((e) => e.item)).toEqual(["a1", "a1"]);
  });

  it("grupo marcado sem itens entra só como grupo", () => {
    let sel = alternarGrupo(selecaoVazia(), grupos[1], true);
    sel = alternarItem(sel, grupos[1], grupos[1].itens[0].chave, false);
    expect(montarImportacao(grupos, sel)).toEqual([{ grupo: "B", item: "", descricao: "" }]);
  });

  it("marcar um item marca o grupo", () => {
    const sel = alternarItem(selecaoVazia(), grupos[1], grupos[1].itens[0].chave, true);
    expect(sel.grupos.has("B")).toBe(true);
  });

  it("grupo que a EC já tem não duplica; item cai dentro dele", () => {
    const soGrupo = alternarGrupo(selecaoVazia(), grupos[1], true);
    const sel = alternarItem(soGrupo, grupos[1], grupos[1].itens[0].chave, false);
    expect(montarImportacao(grupos, sel, ["B"])).toEqual([]);
    expect(montarImportacao(grupos, alternarGrupo(selecaoVazia(), grupos[1], true), ["B"])).toHaveLength(1);
  });

  it("os modelos reais existem para as duas modalidades e não para vazio", () => {
    expect(gruposDaModalidade("Corporativo").length).toBeGreaterThan(3);
    expect(gruposDaModalidade("Cultural").length).toBeGreaterThan(3);
    expect(gruposDaModalidade("")).toEqual([]);
  });
});
