import { describe, expect, it } from "vitest";
import { gerarApelidoFornecedor } from "./fornecedor";

/**
 * Os casos abaixo são os fornecedores REAIS cadastrados na Pólobh (lidos do
 * banco em 27/08/2026) — é neles que o apelido precisa ficar bom, não em nomes
 * inventados.
 */
describe("apelido gerado a partir do nome do fornecedor", () => {
  const casos: [string, string, string][] = [
    // [razão social, nome fantasia, apelido esperado]
    ["SOM & LUZ PRODUÇÕES LTDA", "", "Som & Luz"],
    ["MONTA TUDO ESTRUTURAS LTDA", "", "Monta Tudo"],
    ["BUFFET SABOR & ARTE EIRELI", "", "Sabor & Arte"],
    ["LSPRO LOCACOES, SERVICOS E EVENTOS LTDA", "", "LSPRO"],
    ["REINECKE PRODUCOES CULTURAIS LTDA", "", "Reinecke"],
    ["Casa da Cenografia Produções Ltda", "", "Casa da Cenografia"],
    ["Sonora Áudio e Iluminação Ltda", "", "Sonora Áudio"],
  ];

  for (const [razao, fantasia, esperado] of casos) {
    it(`"${razao}" vira "${esperado}"`, () => {
      expect(gerarApelidoFornecedor(fantasia, razao)).toBe(esperado);
    });
  }
});

describe("de onde o apelido é tirado", () => {
  it("o nome fantasia manda quando existe — já é o nome curto da empresa", () => {
    expect(gerarApelidoFornecedor("Sonora AV", "Sonora Áudio e Iluminação Ltda")).toBe("Sonora AV");
  });

  it("mas o fantasia passa pela mesma peneira quando vem inchado", () => {
    expect(gerarApelidoFornecedor("Som & Luz Produções Ltda", "OUTRA COISA LTDA")).toBe("Som & Luz");
  });

  it("sem nome nenhum, não inventa apelido", () => {
    expect(gerarApelidoFornecedor("", "")).toBe("");
    expect(gerarApelidoFornecedor(undefined, undefined)).toBe("");
  });
});

describe("o que a redução preserva", () => {
  it("a atividade fica quando faz parte do nome (sobrariam menos de duas palavras)", () => {
    // Tirar "Cenografia" deixaria só "Casa" — que não identifica ninguém.
    expect(gerarApelidoFornecedor("", "Casa da Cenografia Ltda")).toBe("Casa da Cenografia");
    expect(gerarApelidoFornecedor("", "Cenografia Ltda")).toBe("Cenografia");
  });

  it("sigla não vira palavra ao acertar a caixa", () => {
    expect(gerarApelidoFornecedor("", "LSPRO EVENTOS LTDA")).toBe("LSPRO");
    expect(gerarApelidoFornecedor("", "MPG COMERCIO LTDA")).toBe("MPG");
    // "SOM" é palavra, não sigla: vira "Som".
    expect(gerarApelidoFornecedor("", "SOM MAIOR LTDA")).toBe("Som Maior");
  });

  it("caixa digitada à mão é respeitada", () => {
    expect(gerarApelidoFornecedor("", "Sonora AV Ltda")).toBe("Sonora AV");
  });

  it("nome comprido é cortado, e nunca termina em 'da'/'e'", () => {
    const apelido = gerarApelidoFornecedor("", "ASSOCIACAO BENEFICENTE DOS TRABALHADORES DA CULTURA MINEIRA LTDA");
    expect(apelido.length).toBeLessThanOrEqual(24);
    expect(apelido.split(" ").length).toBeLessThanOrEqual(4); // 3 identificadoras + ligação
    expect(apelido).not.toMatch(/\s(da|de|do|e|&)$/i);
  });

  it("nome de uma palavra só continua inteiro", () => {
    expect(gerarApelidoFornecedor("", "REINECKE")).toBe("Reinecke");
    expect(gerarApelidoFornecedor("", "PRODUCOES LTDA")).toBe("Producoes");
  });
});
