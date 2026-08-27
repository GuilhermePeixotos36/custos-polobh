import { describe, expect, it } from "vitest";
import { parseNumeroBR } from "./format";

/**
 * O campo de valor não mascara nada enquanto se digita — quem interpreta o que
 * a pessoa escreveu é esta função, na saída do campo. Os casos abaixo são
 * exatamente os jeitos de escrever que aparecem no dia a dia da Pólobh.
 */
describe("parseNumeroBR", () => {
  it("sem vírgula, todo dígito é parte inteira", () => {
    // O vício do campo antigo era o oposto: "1500" virava R$ 15,00.
    expect(parseNumeroBR("1500")).toBe(1500);
    expect(parseNumeroBR("7")).toBe(7);
  });

  it("com vírgula, o que vem depois é centavo", () => {
    expect(parseNumeroBR("1500,5")).toBe(1500.5);
    expect(parseNumeroBR("1500,50")).toBe(1500.5);
    expect(parseNumeroBR("0,99")).toBe(0.99);
  });

  it("entende o ponto de milhar junto da vírgula decimal", () => {
    expect(parseNumeroBR("1.500,50")).toBe(1500.5);
    expect(parseNumeroBR("1.234.567,89")).toBe(1234567.89);
  });

  it("um ponto sozinho: decimal com 1-2 casas, milhar com 3", () => {
    expect(parseNumeroBR("12.5")).toBe(12.5);   // teclado numérico
    expect(parseNumeroBR("12.50")).toBe(12.5);
    expect(parseNumeroBR("1.500")).toBe(1500);  // milhar
  });

  it("aceita o texto sujo que o campo formatado devolve", () => {
    expect(parseNumeroBR("R$ 1.500,00")).toBe(1500);
    expect(parseNumeroBR("R$ 0,00")).toBe(0);
  });

  it("vírgula digitada duas vezes não perde o número", () => {
    expect(parseNumeroBR("10,,5")).toBe(10.5);
  });

  it("guarda o sinal negativo (descontos)", () => {
    expect(parseNumeroBR("-250,75")).toBe(-250.75);
  });

  it("devolve null quando não há número — quem chama decide o que fazer", () => {
    expect(parseNumeroBR("")).toBeNull();
    expect(parseNumeroBR("R$")).toBeNull();
    expect(parseNumeroBR(",")).toBeNull();
  });
});
