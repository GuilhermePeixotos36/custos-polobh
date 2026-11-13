import { describe, expect, it } from "vitest";
import { htmlParaTexto, textoParaHtml } from "./clausulaTexto";
import { blocosDaClausula } from "./contratoDocumento";
import { clausulasDoCodigo, MODELOS_CONTRATO } from "./contratoModelo";

describe("texto da cláusula ⇄ editor", () => {
  const textos = [
    "Um parágrafo simples.",
    "Primeira linha.\nSegunda linha.",
    "Com **negrito** no meio e **outro** também.",
    "Bloco um.\n\nBloco dois, depois de uma linha em branco.",
    "**Parágrafo Único**. Caso a obrigação seja cumprida parcialmente.",
    "Tolerância & novação: a < b > c.",
    "Com __itálico__, ++sublinhado++ e **__++tudo junto++__**.",
    "[centro]Título centralizado",
    "[esq]Texto alinhado à esquerda",
    ">> Parágrafo recuado em dois níveis",
    "- Item com marcador\n- Outro item\n>> - Item recuado",
    "1. Primeiro\n2. Segundo\n3. Terceiro",
    "Texto\n\n- Item depois de um respiro\n\nFim.",
  ];
  for (const t of textos) {
    it(`volta igual: ${t.slice(0, 30)}`, () => {
      expect(htmlParaTexto(textoParaHtml(t))).toBe(t);
    });
  }

  it("o negrito vira <strong> e a linha vazia vira respiro", () => {
    expect(textoParaHtml("A **b**\n\nC")).toBe("<p>A <strong>b</strong></p><p><br></p><p>C</p>");
  });

  it("as demais ferramentas viram o HTML que o editor desenha", () => {
    expect(textoParaHtml("__a__ ++b++")).toBe("<p><em>a</em> <u>b</u></p>");
    expect(textoParaHtml("[centro]t")).toBe('<p style="text-align: center">t</p>');
    expect(textoParaHtml(">> r")).toBe('<p style="margin-left: 80px">r</p>');
    expect(textoParaHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(textoParaHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("entende o que o navegador produz: <b>, <div>, <br> e &nbsp;", () => {
    expect(htmlParaTexto("<p>Texto <b>forte</b> fim</p><div>Outra</div>")).toBe("Texto **forte** fim\nOutra");
    expect(htmlParaTexto("Linha<br>seguinte")).toBe("Linha\nseguinte");
    expect(htmlParaTexto("<p>a&nbsp;b</p>")).toBe("a b");
  });

  it("espaço na ponta do negrito fica fora dos asteriscos", () => {
    expect(htmlParaTexto("<p>ab<b> cd </b>ef</p>")).toBe("ab **cd** ef");
  });

  it("itálico, sublinhado, listas, recuo e alinhamento do navegador", () => {
    expect(htmlParaTexto("<p><i>a</i> <u>b</u></p>")).toBe("__a__ ++b++");
    expect(htmlParaTexto("<ul><li>um</li><li>dois</li></ul>")).toBe("- um\n- dois");
    expect(htmlParaTexto("<ol><li>um</li><li>dois</li></ol>")).toBe("1. um\n2. dois");
    expect(htmlParaTexto('<div style="text-align: center;">Centro</div>')).toBe("[centro]Centro");
    expect(htmlParaTexto('<p style="text-align: left;">Esq</p>')).toBe("[esq]Esq");
    expect(htmlParaTexto("<blockquote><p>Recuado</p></blockquote>")).toBe("> Recuado");
    expect(htmlParaTexto('<p style="margin-left: 80px">Dois</p>')).toBe(">> Dois");
  });

  it("lista dentro de lista (o recuo do navegador) é um nível a mais", () => {
    expect(htmlParaTexto("<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>")).toBe("- a\n> - b\n- c");
  });

  it("item vazio e parágrafo vazio no fim não viram linhas soltas", () => {
    expect(htmlParaTexto("<ul><li>a</li><li><br></li></ul><p><br></p>")).toBe("- a");
  });

  it("vazio fica vazio", () => {
    expect(htmlParaTexto("")).toBe("");
    expect(htmlParaTexto("<br>")).toBe("");
  });
});

const semNegritoNoCabecalho = (b: ReturnType<typeof blocosDaClausula>) =>
  b.map((x) => (x.tipo === "subtitulo" ? { ...x, texto: x.texto.replace(/\*\*/g, "") } : x));

describe("o editor mostra o documento pronto, e o que ele devolve é o que o PDF lê", () => {
  for (const modelo of MODELOS_CONTRATO) {
    for (const c of clausulasDoCodigo(modelo)) {
      it(`${modelo} › ${c.chave}: mesma estrutura no PDF depois de passar pelo editor`, () => {
        const volta = htmlParaTexto(textoParaHtml(c.padrao, c.chave), c.chave);
        expect(semNegritoNoCabecalho(blocosDaClausula(c.chave, volta.split("\n")))).toEqual(
          semNegritoNoCabecalho(blocosDaClausula(c.chave, c.padrao.split("\n"))),
        );
        // E é estável: passar de novo não muda nada.
        expect(htmlParaTexto(textoParaHtml(volta, c.chave), c.chave)).toBe(volta);
      });
    }
  }

  it("cláusula de bullets mostra bullet em cada parágrafo, como o contrato", () => {
    expect(textoParaHtml("Um.\nDois.", "foro")).toBe("<ul><li>Um.</li><li>Dois.</li></ul>");
    // Sem bullet no texto salvo: o editor devolve plano, como estava.
    expect(htmlParaTexto("<ul><li>Um.</li><li>Dois.</li></ul>", "foro")).toBe("Um.\nDois.");
  });

  it("tirar o bullet de um parágrafo numa cláusula de bullets grava [just], para o PDF obedecer", () => {
    const texto = htmlParaTexto("<ul><li>Um.</li></ul><p>Sem bullet.</p>", "foro");
    expect(texto).toBe("Um.\n[just]Sem bullet.");
    expect(blocosDaClausula("foro", texto.split("\n"))).toEqual([
      { tipo: "item", texto: "Um." },
      { tipo: "texto", texto: "Sem bullet.", alinhar: "just" },
    ]);
  });

  it("os cabeçalhos da Segunda saem em negrito e a lista vem com bullet", () => {
    const html = textoParaHtml("São obrigações do(a) CONTRATADO(A):\n\nFazer.\nOutra.", "obrigacoes");
    expect(html).toBe("<p><strong>São obrigações do(a) CONTRATADO(A):</strong></p><p><br></p><ul><li>Fazer.</li><li>Outra.</li></ul>");
  });

  it("na Primeira o parágrafo comum continua parágrafo", () => {
    expect(textoParaHtml("Texto.", "objeto")).toBe("<p>Texto.</p>");
    expect(htmlParaTexto("<p>Texto.</p>", "objeto")).toBe("Texto.");
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
