import { describe, expect, it } from "vitest";
import { htmlParaTexto, textoParaHtml } from "./clausulaTexto";
import { clausulasDoCodigo, MODELOS_CONTRATO } from "./contratoModelo";

describe("texto da cláusula ⇄ editor", () => {
  const textos = [
    "Um parágrafo simples.",
    "Primeira linha.\nSegunda linha.",
    "Com **negrito** no meio e **outro** também.",
    "Bloco um.\n\nBloco dois, depois de uma linha em branco.",
    "**Parágrafo Único**. Caso a obrigação seja cumprida parcialmente.",
    "Tolerância & novação: a < b > c.",
  ];
  for (const t of textos) {
    it(`volta igual: ${t.slice(0, 30)}`, () => {
      expect(htmlParaTexto(textoParaHtml(t))).toBe(t);
    });
  }

  it("o negrito vira <strong> e a linha vazia vira respiro", () => {
    expect(textoParaHtml("A **b**\n\nC")).toBe("<p>A <strong>b</strong></p><p><br></p><p>C</p>");
  });

  it("entende o que o navegador produz: <b>, <div>, <br> e &nbsp;", () => {
    expect(htmlParaTexto("<p>Texto <b>forte</b> fim</p><div>Outra</div>")).toBe("Texto **forte** fim\nOutra");
    expect(htmlParaTexto("Linha<br>seguinte")).toBe("Linha\nseguinte");
    expect(htmlParaTexto("<p>a&nbsp;b</p>")).toBe("a b");
  });

  it("espaço na ponta do negrito fica fora dos asteriscos", () => {
    expect(htmlParaTexto("<p>ab<b> cd </b>ef</p>")).toBe("ab **cd** ef");
  });

  it("itálico, sublinhado e listas viram texto comum, e item de lista vira linha", () => {
    expect(htmlParaTexto("<p><i>a</i> <u>b</u></p>")).toBe("a b");
    expect(htmlParaTexto("<ul><li>um</li><li>dois</li></ul>")).toBe("um\ndois");
  });

  it("vazio fica vazio", () => {
    expect(htmlParaTexto("")).toBe("");
    expect(htmlParaTexto("<br>")).toBe("");
  });
});

describe("os textos de fábrica atravessam o editor sem mudar", () => {
  for (const modelo of MODELOS_CONTRATO) {
    for (const c of clausulasDoCodigo(modelo)) {
      it(`${modelo} › ${c.chave}`, () => {
        expect(htmlParaTexto(textoParaHtml(c.padrao))).toBe(c.padrao);
      });
    }
  }
});
