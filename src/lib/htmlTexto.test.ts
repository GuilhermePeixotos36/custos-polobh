import { describe, expect, it } from "vitest";
import { htmlParaLinhas } from "./htmlTexto";

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
});
