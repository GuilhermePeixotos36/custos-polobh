import { describe, expect, it } from "vitest";
import { compararValores } from "./Ordenacao";

/** Comparador usado por TODAS as listagens do sistema — vale travar o contrato. */
describe("compararValores", () => {
  it("ordena números por grandeza, não como texto", () => {
    expect(compararValores(2, 10)).toBeLessThan(0);
    expect([10, 2, 1].sort(compararValores)).toEqual([1, 2, 10]);
  });

  it("coloca verdadeiro antes de falso (ex.: EC ativa no topo)", () => {
    expect(compararValores(true, false)).toBeLessThan(0);
    expect(compararValores(false, true)).toBeGreaterThan(0);
    expect(compararValores(true, true)).toBe(0);
  });

  it("compara texto ignorando acento e caixa", () => {
    expect(compararValores("ácido", "Acido")).toBe(0);
    expect(compararValores("Ana", "Bruno")).toBeLessThan(0);
  });

  it("ordena texto com número embutido pelo valor do número", () => {
    expect(["Item 10", "Item 2"].sort(compararValores)).toEqual(["Item 2", "Item 10"]);
  });

  it("joga vazio, nulo e indefinido para o fim, em qualquer direção", () => {
    expect(compararValores("", "Ana")).toBeGreaterThan(0);
    expect(compararValores(null, "Ana")).toBeGreaterThan(0);
    expect(compararValores(undefined, "Ana")).toBeGreaterThan(0);
    expect(compararValores("Ana", "")).toBeLessThan(0);
    expect(compararValores("", null)).toBe(0);
  });

  it("não confunde zero nem falso com vazio", () => {
    expect(compararValores(0, 5)).toBeLessThan(0);
    expect(compararValores(false, true)).toBeGreaterThan(0);
  });

  it("mantém a ordem de origem entre iguais (ordenação estável)", () => {
    const linhas = [
      { id: "a", ativa: true },
      { id: "b", ativa: true },
      { id: "c", ativa: false },
    ];
    const ordenado = [...linhas].sort((x, y) => compararValores(x.ativa, y.ativa));
    expect(ordenado.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});
