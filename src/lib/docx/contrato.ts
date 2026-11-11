/**
 * O contrato em Word, no padrão dos modelos da Pólobh.
 *
 * Os dois .docx que a Marisa mandou em 16/09/2026 não são "um texto": eles têm
 * uma forma, e é a forma que faz o documento ser reconhecido por quem assina —
 * Arial 9, o título dentro de uma caixa, cada cláusula anunciada por uma tarja
 * cinza, a qualificação das partes em bloco, as duas assinaturas lado a lado e
 * as duas testemunhas embaixo. Este arquivo reproduz isso.
 *
 * REVISÃO DE 11/11/2026 ("a formatação dos contratos está ruim e confusa"). O
 * que estava errado não era a identidade do modelo, e sim a falta de ritmo:
 *
 *  · as tarjas de cláusula colavam no parágrafo de cima e não tinham ar;
 *  · toda linha do contrato tinha o mesmo peso — subtítulo, valores, obrigações
 *    e ressalva se misturavam, separados por linhas em branco soltas;
 *  · os valores eram quatro frases soltas, e o total a pagar não se destacava;
 *  · a qualificação das partes era uma pilha de linhas sem alinhamento;
 *  · a cidade e a data ficavam numa página e as assinaturas na seguinte;
 *  · uma página solta do meio do contrato não dizia de qual contrato era.
 *
 * Nada do TEXTO muda: só a forma. Quem decide a função de cada linha é
 * `blocosDaClausula` (domínio, com teste); aqui só se desenha.
 *
 * UMA TROCA CONSCIENTE: no modelo original, o título e as tarjas de cláusula
 * são CAIXAS DE TEXTO flutuantes do Word. Aqui cada uma é uma tabela de uma
 * célula, com o mesmo cinza (EFEFEF) e a mesma borda preta. O resultado
 * impresso é o mesmo; a diferença é que a tabela acompanha o texto quando a
 * cláusula muda de tamanho, e a caixa flutuante não — ela ficaria por cima do
 * parágrafo seguinte no primeiro contrato em que alguém escrevesse três linhas
 * a mais na vigência.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { BlocoClausula, ContratoDocumento, ParteContrato } from "@/domain/contratoDocumento";
import { blocosDaClausula, partirEmDestaques } from "@/domain/contratoDocumento";

/** 9pt. O modelo inteiro é escrito neste corpo; só o título sobe. */
const CORPO = 18;
const FONTE = "Arial";
const CINZA = "EFEFEF";
const CINZA_MEDIO = "D9D9D9";
const GRADE = "A6A6A6";

/** Largura útil da página em twips: A4 (11906) menos as margens esquerda e direita. */
const MARGEM = { top: 720, right: 566, bottom: 900, left: 708 };
const LARGURA = 11906 - MARGEM.left - MARGEM.right;

/** A borda fina e preta das caixas do modelo, nos quatro lados. */
const BORDA = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDAS_CAIXA = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const LEVE = { style: BorderStyle.SINGLE, size: 4, color: GRADE };
const BORDAS_GRADE = { top: LEVE, bottom: LEVE, left: LEVE, right: LEVE, insideHorizontal: LEVE, insideVertical: LEVE };
const SEM = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDAS_NENHUMA = { top: SEM, bottom: SEM, left: SEM, right: SEM, insideHorizontal: SEM, insideVertical: SEM };

/** Respiro entre parágrafos do corpo — no lugar das linhas em branco soltas. */
const ENTRE_PARAGRAFOS = 100;
/** Entrelinha de 1,1: no corpo de 9pt, o texto justificado respira sem alongar o contrato. */
const ENTRELINHA = 264;

const run = (texto: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text: texto, bold: o.bold, italics: o.italics, size: o.size ?? CORPO, font: FONTE, color: o.color });

const p = (
  texto: string,
  o: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    antes?: number;
    depois?: number;
    keepNext?: boolean;
  } = {}
) =>
  new Paragraph({
    alignment: o.align,
    keepNext: o.keepNext,
    spacing: { before: o.antes ?? 0, after: o.depois ?? 60 },
    children: [run(texto, o)],
  });

/** Texto do corpo, com CONTRATANTE e CONTRATADO(A) em negrito. */
const destaques = (texto: string, italics = false) =>
  partirEmDestaques(texto).map((t) => new TextRun({ text: t.texto, bold: t.forte, italics, size: CORPO, font: FONTE }));

/** Parágrafo comum do corpo de uma cláusula. */
const pCorpo = (texto: string, o: { italics?: boolean; antes?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    keepLines: true,
    spacing: { before: o.antes ?? 0, after: ENTRE_PARAGRAFOS, line: ENTRELINHA },
    children: destaques(texto, o.italics),
  });

/** Um item de lista, com recuo suspenso — a segunda linha alinha com o texto, não com a bolinha. */
const pItem = (texto: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    keepLines: true,
    bullet: { level: 0 },
    indent: { left: 360, hanging: 220 },
    spacing: { after: 70, line: ENTRELINHA },
    children: destaques(texto),
  });

/** Subtítulo dentro da cláusula — "DESCRITIVO DOS SERVIÇOS…", "São obrigações do(a) …". */
const pSubtitulo = (texto: string) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 140, after: 70 },
    children: partirEmDestaques(texto).map((t) => new TextRun({ text: t.texto, bold: true, size: CORPO, font: FONTE })),
  });

const celula = (
  filhos: Paragraph[],
  o: { largura: number; fundo?: string; span?: number; alinhar?: "meio" } = { largura: 0 }
) =>
  new TableCell({
    width: { size: o.largura, type: WidthType.DXA },
    columnSpan: o.span,
    verticalAlign: o.alinhar ? VerticalAlign.CENTER : undefined,
    shading: o.fundo ? { type: ShadingType.CLEAR, fill: o.fundo, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    children: filhos,
  });

/** Uma caixa cinza de largura inteira — o título e cada tarja de cláusula. */
const caixa = (filhos: Paragraph[]) =>
  new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [LARGURA],
    layout: TableLayoutType.FIXED,
    borders: BORDAS_CAIXA,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: LARGURA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: CINZA, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: filhos,
          }),
        ],
      }),
    ],
  });

/** Um respiro de altura fixa entre blocos — não é linha em branco de texto. */
const respiro = (altura: number, keepNext = false) =>
  new Paragraph({ keepNext, spacing: { before: 0, after: 0, line: altura, lineRule: "exact" }, children: [run("", { size: 2 })] });

/** A tarja de uma cláusula: ar em cima, a caixa, ar embaixo — e sempre junto do primeiro parágrafo. */
const tarja = (titulo: string): (Paragraph | Table)[] => [
  respiro(200, true),
  caixa([p(titulo, { bold: true, depois: 0, keepNext: true })]),
  respiro(120, true),
];

/** A qualificação de uma das partes: rótulos alinhados numa coluna, valores em outra. */
function bloco(parte: ParteContrato): Table {
  const COL_ROTULO = 2100; // a mesma de `tabelaDeValores`
  const COL_VALOR = LARGURA - COL_ROTULO;
  const linha = (rotulo: string, valor: string) =>
    new TableRow({
      cantSplit: true,
      children: [
        celula([p(rotulo, { depois: 0, keepNext: true })], { largura: COL_ROTULO, fundo: CINZA }),
        celula([p(valor || "", { bold: true, depois: 0, keepNext: true })], { largura: COL_VALOR }),
      ],
    });
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [COL_ROTULO, COL_VALOR],
    layout: TableLayoutType.FIXED,
    borders: BORDAS_GRADE,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [celula([p(parte.papel, { bold: true, depois: 0, keepNext: true })], { largura: LARGURA, fundo: CINZA_MEDIO, span: 2 })],
      }),
      linha("Nome / Razão Social", parte.razaoSocial),
      linha("CNPJ / CPF", parte.cnpjCpf),
      linha("Insc. Estadual", parte.inscricaoEstadual),
      linha("Telefone", parte.telefone),
      linha("Endereço", parte.endereco),
      linha("Município", parte.municipio),
      new TableRow({
        cantSplit: true,
        children: [
          celula([p("Neste ato representando(a) em conformidade com seu contrato ou estatuto social.", { italics: true, depois: 0 })], {
            largura: LARGURA,
            span: 2,
          }),
        ],
      }),
    ],
  });
}

/**
 * Os valores do objeto numa tabela: o que se paga fica no fim, em destaque.
 *
 * Largura inteira e a MESMA coluna de rótulos da qualificação das partes
 * (11/11/2026): com uma tabela estreita no meio de blocos largos, a página
 * parecia desalinhada — as linhas verticais precisam cair no mesmo lugar.
 */
function tabelaDeValores(linhas: { rotulo: string; valor: string }[]): Table {
  const COL_ROTULO = 2100;
  const COL_VALOR = LARGURA - COL_ROTULO;
  const ultima = linhas.length - 1;
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [COL_ROTULO, COL_VALOR],
    layout: TableLayoutType.FIXED,
    borders: BORDAS_GRADE,
    rows: linhas.map((l, i) => {
      const destaque = i === ultima;
      return new TableRow({
        cantSplit: true,
        children: [
          celula([p(l.rotulo, { depois: 0, keepNext: i < ultima })], { largura: COL_ROTULO, fundo: destaque ? CINZA_MEDIO : CINZA }),
          celula([p(l.valor, { bold: true, size: destaque ? 22 : CORPO, depois: 0, keepNext: i < ultima })], {
            largura: COL_VALOR,
            fundo: destaque ? CINZA : undefined,
          }),
        ],
      });
    }),
  });
}

/** O corpo de uma cláusula, bloco a bloco. */
function corpoDaClausula(blocos: BlocoClausula[]): (Paragraph | Table)[] {
  const saida: (Paragraph | Table)[] = [];
  let anterior: BlocoClausula["tipo"] | "" = "";
  for (const b of blocos) {
    switch (b.tipo) {
      case "texto":
        // Depois de uma lista, o parágrafo comum ganha um respiro a mais.
        saida.push(pCorpo(b.texto, { antes: anterior === "item" ? 80 : 0 }));
        break;
      case "subtitulo":
        saida.push(pSubtitulo(b.texto));
        break;
      case "item":
        saida.push(pItem(b.texto));
        break;
      case "campo":
        saida.push(
          new Paragraph({
            keepLines: true,
            spacing: { before: 40, after: 60 },
            children: [run(`${b.rotulo}: `, { bold: true }), run(b.valor)],
          })
        );
        break;
      case "valores":
        saida.push(respiro(80), tabelaDeValores(b.linhas), respiro(100));
        break;
      case "nota":
        saida.push(pCorpo(b.texto, { italics: true, antes: 60 }));
        break;
    }
    anterior = b.tipo;
  }
  return saida;
}

/** A linha em que se assina: um traço e, embaixo, quem é. */
const assinatura = (papel: string, nome: string) => [
  p("_________________________________________", { antes: 520, keepNext: true }),
  p(papel, { bold: true, keepNext: true }),
  p(nome || "", { depois: 120, keepNext: true }),
];

const testemunha = (nome: string, cpf: string) => [
  p("_________________________________________", { antes: 360, keepNext: true }),
  p("TESTEMUNHA", { bold: true, keepNext: true }),
  p(nome || "", { keepNext: true }),
  new Paragraph({
    spacing: { after: 60 },
    children: [run("Nome e CPF: ", { bold: true }), run(cpf || "")],
  }),
];

/**
 * As assinaturas e as testemunhas numa tabela só, de duas colunas e duas
 * linhas, que não se parte entre páginas — com a cidade e a data coladas em
 * cima. Antes a data ficava no fim de uma página e as assinaturas sozinhas na
 * seguinte, e um contrato assinado numa folha sem data é um contrato frágil.
 */
function assinaturas(c: ContratoDocumento): Table {
  const metade = Math.floor(LARGURA / 2);
  const col = (filhos: Paragraph[]) =>
    new TableCell({ width: { size: metade, type: WidthType.DXA }, margins: { left: 0, right: 200 }, children: filhos });
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [metade, LARGURA - metade],
    layout: TableLayoutType.FIXED,
    borders: BORDAS_NENHUMA,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          col(assinatura(c.assinaturas[0].papel, c.assinaturas[0].nome)),
          col(assinatura(c.assinaturas[1].papel, c.assinaturas[1].nome)),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          col(testemunha(c.testemunhas[0].nome, c.testemunhas[0].cpf)),
          col(testemunha(c.testemunhas[1].nome, c.testemunhas[1].cpf)),
        ],
      }),
    ],
  });
}

/** O documento inteiro, pronto para o `Packer`. */
export function documentoDoContrato(c: ContratoDocumento): Document {
  const identificacao = [c.os ? `OS ${c.os}` : "OS", c.data ? `Data ${c.data}` : "Data"].join("   |   ");
  const filhos: (Paragraph | Table)[] = [
    caixa([
      p(c.titulo, { bold: true, size: 32, align: AlignmentType.CENTER, depois: 40 }),
      p(identificacao, { size: 22, align: AlignmentType.CENTER, depois: 0 }),
    ]),
    respiro(160),
    bloco(c.contratante),
    respiro(160),
    bloco(c.contratado),
  ];

  for (const cl of c.clausulas) {
    filhos.push(...tarja(cl.titulo), ...corpoDaClausula(blocosDaClausula(cl.chave, cl.paragrafos)));
  }

  filhos.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      keepNext: true,
      keepLines: true,
      spacing: { before: 240, after: 120, line: ENTRELINHA },
      children: [run(c.fecho)],
    }),
    p(c.cidadeData, { antes: 120, keepNext: true }),
    assinaturas(c)
  );

  // Nas páginas seguintes, um cabeçalho diz de qual contrato é a folha — e a
  // primeira, que já tem o título, fica limpa.
  const cabecalho = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRADE, space: 2 } },
        spacing: { after: 120 },
        children: [run(`${c.titulo} — ${c.os ? `OS ${c.os}` : "OS"}`, { size: 14, color: "595959" })],
      }),
    ],
  });
  const rodape = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          run("pág ", { size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONTE }),
          run(" de ", { size: 16 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONTE }),
        ],
      }),
    ],
  });

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: CORPO } } } },
    sections: [
      {
        properties: {
          titlePage: true,
          // As mesmas margens do modelo, em twips — é o que dá ao documento a
          // mancha de texto larga que a Pólobh usa.
          page: { margin: { ...MARGEM, header: 360, footer: 400 } },
        },
        headers: { default: cabecalho, first: new Header({ children: [new Paragraph({ children: [] })] }) },
        footers: { default: rodape, first: rodape },
        children: filhos,
      },
    ],
  });
}

/** Os bytes do .docx — o que o navegador baixa. */
export const contratoEmBytes = (c: ContratoDocumento): Promise<Blob> =>
  Packer.toBlob(documentoDoContrato(c));
