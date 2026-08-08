import { describe, expect, it } from "vitest";
import { sanitizarHtmlEditor } from "./sanitizeHtml";

/**
 * O único ponto do app que usa dangerouslySetInnerHTML é a Descrição Completa
 * da EC, e ela passa por aqui. Estes testes travam o comportamento de lista
 * branca para que ninguém afrouxe sem perceber.
 */
describe("sanitizarHtmlEditor", () => {
  it("mantém a formatação suportada pelo editor", () => {
    const html = "<p>Texto <b>negrito</b> e <i>itálico</i></p><ul><li>um</li></ul>";
    expect(sanitizarHtmlEditor(html)).toBe(html);
  });

  it("remove script, preservando o texto ao redor", () => {
    const saida = sanitizarHtmlEditor("<p>antes</p><script>alert(1)</script><p>depois</p>");
    expect(saida).not.toContain("<script");
    expect(saida).toContain("antes");
    expect(saida).toContain("depois");
  });

  it("remove atributos de evento", () => {
    const saida = sanitizarHtmlEditor('<p onclick="roubar()">oi</p>');
    expect(saida).not.toContain("onclick");
    expect(saida).toContain("oi");
  });

  it("remove href e src (nada de javascript: nem vazamento por imagem)", () => {
    const saida = sanitizarHtmlEditor('<a href="javascript:alert(1)">x</a><img src="http://tracker/a.gif">');
    expect(saida).not.toContain("javascript:");
    expect(saida).not.toContain("href");
    expect(saida).not.toContain("<img");
  });

  it("desembrulha tag não permitida mas preserva o conteúdo", () => {
    const saida = sanitizarHtmlEditor("<section><p>conteudo</p></section>");
    expect(saida).toBe("<p>conteudo</p>");
  });

  it("mantém só os estilos da lista branca", () => {
    const saida = sanitizarHtmlEditor('<p style="text-align: center; position: fixed">x</p>');
    expect(saida).toContain("text-align: center");
    expect(saida).not.toContain("position");
  });

  it("remove comentários", () => {
    expect(sanitizarHtmlEditor("<p>a</p><!-- segredo -->")).toBe("<p>a</p>");
  });

  it("string vazia continua vazia", () => {
    expect(sanitizarHtmlEditor("")).toBe("");
  });
});
