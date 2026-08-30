import { describe, expect, it } from "vitest";
import { moverNaLista } from "./MoverSetas";

/**
 * O motor das setas de subir/descer — usado pelos itens da EC, pelo cronograma
 * do projeto, pelo roteiro, pelos modelos de check-list e pelo cronograma da OS.
 * Uma regressão aqui aparece em cinco telas de uma vez.
 */
describe("moverNaLista", () => {
  const lista = ["a", "b", "c"];

  it("troca o item com o vizinho de cima", () => {
    expect(moverNaLista(lista, 1, -1)).toEqual(["b", "a", "c"]);
  });

  it("troca o item com o vizinho de baixo", () => {
    expect(moverNaLista(lista, 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("não altera a lista original — as telas guardam o estado anterior", () => {
    moverNaLista(lista, 0, 1);
    expect(lista).toEqual(["a", "b", "c"]);
  });

  /**
   * O contrato de que as telas dependem: movimento impossível devolve a MESMA
   * referência, e não uma cópia igual. É isso que impede a EC de se marcar como
   * "alterada" quando alguém clica na seta de um item que já está na ponta.
   */
  it("na borda devolve a mesma referência, não uma cópia", () => {
    expect(moverNaLista(lista, 0, -1)).toBe(lista);
    expect(moverNaLista(lista, 2, 1)).toBe(lista);
  });

  it("índice fora da lista também devolve a mesma referência", () => {
    expect(moverNaLista(lista, -1, 1)).toBe(lista);
    expect(moverNaLista(lista, 9, -1)).toBe(lista);
  });

  it("lista de um item não se mexe para lado nenhum", () => {
    const so = ["único"];
    expect(moverNaLista(so, 0, -1)).toBe(so);
    expect(moverNaLista(so, 0, 1)).toBe(so);
  });
});
