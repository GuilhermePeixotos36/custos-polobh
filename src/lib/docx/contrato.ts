/**
 * O contrato em Word, no padrão dos modelos da Pólobh.
 *
 * Os dois .docx que a Marisa mandou em 16/09/2026 não são "um texto": eles têm
 * uma forma, e é a forma que faz o documento ser reconhecido por quem assina —
 * Arial 9, o título dentro de uma caixa, cada cláusula anunciada por uma tarja
 * cinza, a qualificação das partes em bloco, as duas assinaturas lado a lado e
 * as duas testemunhas embaixo. Este arquivo reproduz isso.
 *
 * UMA TROCA CONSCIENTE: no modelo original, o título e as tarjas de cláusula
 * são CAIXAS DE TEXTO flutuantes do Word. Aqui cada uma é uma tabela de uma
 * célula, com o mesmo cinza (EFEFEF) e a mesma borda preta. O resultado
 * impresso é o mesmo; a diferença é que a tabela acompanha o texto quando a
 * cláusula muda de tamanho, e a caixa flutuante não — ela ficaria por cima do
 * parágrafo seguinte no primeiro contrato em que alguém escrevesse três linhas
 * a mais na vigência.
 *
 * O CONTEÚDO não se decide aqui: vem pronto de `domain/contratoDocumento`, que
 * é função pura da OS e tem teste. Este módulo só desenha.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ContratoDocumento, ParteContrato } from "@/domain/contratoDocumento";
import { partirEmDestaques } from "@/domain/contratoDocumento";

/** 9pt. O modelo inteiro é escrito neste corpo; só o título sobe. */
const CORPO = 18;
const FONTE = "Arial";
const CINZA = "EFEFEF";

/** A borda fina e preta das caixas do modelo, nos quatro lados. */
const BORDA = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDAS_CAIXA = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };

const p = (
  texto: string,
  o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; antes?: number; depois?: number } = {}
) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: o.antes ?? 0, after: o.depois ?? 60 },
    children: [new TextRun({ text: texto, bold: o.bold, size: o.size ?? CORPO, font: FONTE })],
  });

/** Parágrafo do corpo de uma cláusula, com CONTRATANTE e CONTRATADO(A) em negrito. */
const pCorpo = (texto: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 60 },
    children: partirEmDestaques(texto).map(
      (t) => new TextRun({ text: t.texto, bold: t.forte, size: CORPO, font: FONTE })
    ),
  });

/** Uma caixa cinza de largura inteira — o título e cada tarja de cláusula. */
const caixa = (filhos: Paragraph[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDAS_CAIXA,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: CINZA, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: filhos,
          }),
        ],
      }),
    ],
  });

/** A qualificação de uma das partes, com os rótulos do modelo. */
function bloco(parte: ParteContrato): Paragraph[] {
  const linha = (rotulo: string, valor: string) =>
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `${rotulo} `, size: CORPO, font: FONTE }),
        new TextRun({ text: valor || "", bold: true, size: CORPO, font: FONTE }),
      ],
    });
  return [
    p(parte.papel, { bold: true, antes: 120 }),
    linha("Nome / Razão Social:", parte.razaoSocial),
    linha("CNPJ / CPF:", parte.cnpjCpf),
    linha("Insc. Estadual:", parte.inscricaoEstadual),
    linha("Telefone:", parte.telefone),
    linha("Endereço:", parte.endereco),
    linha("Municipio:", parte.municipio),
    p("Neste ato representando(a) em conformidade com seu contrato ou estatuto social.", { depois: 120 }),
  ];
}

/** Duas colunas sem borda — as assinaturas e, depois, as testemunhas. */
const duasColunas = (esquerda: Paragraph[], direita: Paragraph[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: esquerda }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: direita }),
        ],
      }),
    ],
  });

/** A linha em que se assina: um traço e, embaixo, quem é. */
const assinatura = (papel: string, nome: string) => [
  p("_________________________________________", { antes: 480 }),
  p(papel, { bold: true }),
  p(nome || "", { depois: 120 }),
];

const testemunha = (nome: string, cpf: string) => [
  p("_________________________________________", { antes: 360 }),
  p("TESTEMUNHA", { bold: true }),
  p(nome || "", {}),
  new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Nome e CPF: ", bold: true, size: CORPO, font: FONTE }),
      new TextRun({ text: cpf || "", size: CORPO, font: FONTE }),
    ],
  }),
];

/** O documento inteiro, pronto para o `Packer`. */
export function documentoDoContrato(c: ContratoDocumento): Document {
  const filhos: (Paragraph | Table)[] = [
    caixa([
      p(c.titulo, { bold: true, size: 32, align: AlignmentType.CENTER }),
      p(c.os ? `OS ${c.os}` : "OS", { size: 24, align: AlignmentType.CENTER }),
      p(c.data ? `Data ${c.data}` : "Data", { size: 24, align: AlignmentType.CENTER, depois: 0 }),
    ]),
    ...bloco(c.contratante),
    ...bloco(c.contratado),
  ];

  for (const cl of c.clausulas) {
    filhos.push(caixa([p(cl.titulo, { bold: true, depois: 0 })]));
    filhos.push(p("", { depois: 0 }));
    for (const linha of cl.paragrafos) {
      filhos.push(linha.trim() ? pCorpo(linha) : p("", { depois: 0 }));
    }
  }

  filhos.push(
    p(c.fecho, { antes: 180, align: AlignmentType.JUSTIFIED }),
    p(c.cidadeData, { antes: 240 }),
    duasColunas(
      assinatura(c.assinaturas[0].papel, c.assinaturas[0].nome),
      assinatura(c.assinaturas[1].papel, c.assinaturas[1].nome)
    ),
    duasColunas(
      testemunha(c.testemunhas[0].nome, c.testemunhas[0].cpf),
      testemunha(c.testemunhas[1].nome, c.testemunhas[1].cpf)
    )
  );

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: CORPO } } } },
    sections: [
      {
        properties: {
          // As mesmas margens do modelo, em twips — é o que dá ao documento a
          // mancha de texto larga que a Pólobh usa.
          page: { margin: { top: 720, right: 566, bottom: 900, left: 708 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "pág ", size: 16, font: FONTE }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONTE }),
                ],
              }),
            ],
          }),
        },
        children: filhos,
      },
    ],
  });
}

/** Os bytes do .docx — o que o navegador baixa. */
export const contratoEmBytes = (c: ContratoDocumento): Promise<Blob> =>
  Packer.toBlob(documentoDoContrato(c));
