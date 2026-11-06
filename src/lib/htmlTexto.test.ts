import { describe, expect, it } from "vitest";
import { htmlParaLinhas, htmlParaTrechos } from "./htmlTexto";

describe("htmlParaLinhas", () => {
  it("lista simples vira linhas com •", () => {
    expect(htmlParaLinhas("<ul><li>Bebidas</li><li>Salgados</li></ul>")).toEqual(["• Bebidas", "• Salgados"]);
  });

  it("subtópico fica recuado, com ◦, logo abaixo do título", () => {
    const html = "<ul><li><strong>Saguão Prédio</strong><ul><li>01 profissional</li></ul></li><li><strong>Auditório</strong><ul><li>02 profissionais</li></ul></li></ul>";
    expect(htmlParaLinhas(html)).toEqual(["• Saguão Prédio", "    ◦ 01 profissional", "• Auditório", "    ◦ 02 profissionais"]);
  });

  it("parágrafos seguem separados por linha em branco", () => {
    expect(htmlParaLinhas("<p>Um</p><p>Dois</p>")).toEqual(["Um", "", "Dois"]);
  });

  it("parágrafos vazios em série viram uma linha em branco só", () => {
    expect(htmlParaLinhas(`<p>Um</p>${"<p></p>".repeat(20)}<p>Dois</p>${"<p></p>".repeat(5)}`)).toEqual(["Um", "", "Dois"]);
  });

  it("quebra de linha crua dentro do HTML é espaço, não linha nova", () => {
    expect(htmlParaLinhas("<ul><li>Sobremesa&nbsp;\n\n- Escolher 01 opção</li></ul>")).toEqual(["• Sobremesa - Escolher 01 opção"]);
  });

  it("traço digitado vira tópico; dentro de tópico, subtópico", () => {
    expect(htmlParaLinhas("<ul><li>&nbsp; - Salmone</li></ul><p>- Pudim</p>")).toEqual(["    ◦ Salmone", "• Pudim"]);
  });
});

describe("htmlParaTrechos", () => {
  it("preserva o negrito em trechos", () => {
    expect(htmlParaTrechos("<ul><li><strong>Entrada</strong> - salada</li><li>Café</li></ul>")).toEqual([
      { texto: "• ", negrito: false },
      { texto: "Entrada", negrito: true },
      { texto: " - salada\n• Café", negrito: false },
    ]);
  });
});
