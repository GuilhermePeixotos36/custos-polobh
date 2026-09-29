/**
 * O relatório do check-list em Word.
 *
 *   node scripts/relatorio-em-docx.cjs
 *
 * Lê `docs/checklist-ponto-a-ponto.md` e escreve o .docx ao lado. Existe porque
 * o relatório é revisado em Markdown, no repositório, mas quem o lê na Pólobh
 * lê em Word — e converter à mão a cada revisão é a receita para as duas
 * versões discordarem.
 *
 * O conversor é pequeno de propósito: só o que este relatório usa — títulos,
 * parágrafos, listas numeradas, tabelas, negrito, itálico e `código`. Um
 * conversor de Markdown completo seria uma dependência a mais para cobrir
 * marcação que o documento não tem.
 */
const fs = require("fs");
const {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType, PageNumber, Footer,
} = require("docx");

const path = require("path");
const RAIZ = path.resolve(__dirname, "..");
const ENTRADA = path.join(RAIZ, "docs/checklist-ponto-a-ponto.md");
const SAIDA = path.join(RAIZ, "docs/Checklist Pólobh — ponto a ponto.docx");
const MD = fs.readFileSync(ENTRADA, "utf8");

const FONTE = "Calibri";
const CORPO = 21;          // 10,5pt
const TINTA = "1F2430";
const TINTA2 = "4A5262";
const ACENTO = "8C1D2C";   // vinho, perto da marca
const CINZA = "EFEFF2";
const CINZA_CLARO = "F8F8FA";

// A4 retrato, margens de 2 cm
const LARGURA_UTIL = 11906 - 2 * 1134;

/* ---------- formatação em linha: **negrito**, `código`, *itálico* ---------- */
function runs(texto, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let fim = 0;
  const empurra = (t, extra) => {
    if (!t) return;
    out.push(new TextRun({ text: t, font: FONTE, size: CORPO, color: TINTA, ...base, ...extra }));
  };
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    empurra(texto.slice(fim, m.index));
    const bruto = m[0];
    if (bruto.startsWith("**")) empurra(bruto.slice(2, -2), { bold: true });
    else if (bruto.startsWith("`")) empurra(bruto.slice(1, -1), { font: "Consolas", size: CORPO - 2, color: ACENTO });
    else empurra(bruto.slice(1, -1), { italics: true });
    fim = m.index + bruto.length;
  }
  empurra(texto.slice(fim));
  return out.length ? out : [new TextRun({ text: "", font: FONTE, size: CORPO })];
}

const p = (texto, o = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: o.antes ?? 0, after: o.depois ?? 120, line: 264 },
    children: runs(texto, o.base ?? {}),
  });

/* ------------------------------ tabelas ---------------------------------- */
const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const LINHA = { style: BorderStyle.SINGLE, size: 2, color: "D8D8DE" };

function larguras(n, cabecalhos) {
  if (n === 2) return cabecalhos[0].trim() === "" ? [700, LARGURA_UTIL - 700] : [3100, LARGURA_UTIL - 3100];
  if (n === 3) return [2500, 900, LARGURA_UTIL - 3400];
  if (n === 5) { const c = 1500; return [LARGURA_UTIL - 4 * c, c, c, c, c]; }
  const w = Math.floor(LARGURA_UTIL / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? LARGURA_UTIL - w * (n - 1) : w));
}

function celula(texto, larg, o = {}) {
  return new TableCell({
    width: { size: larg, type: WidthType.DXA },
    shading: o.fundo ? { type: ShadingType.CLEAR, fill: o.fundo, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [
      new Paragraph({
        alignment: o.centro ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 252 },
        children: runs(texto, o.base ?? {}),
      }),
    ],
  });
}

function tabela(linhas) {
  const cabecalhos = linhas[0];
  const aliases = linhas[1];
  const corpo = linhas.slice(2);
  const n = cabecalhos.length;
  const cols = larguras(n, cabecalhos);
  const centrado = aliases.map((a) => /^:-+:$/.test(a.trim()));

  const cabecalho = new TableRow({
    tableHeader: true,
    children: cabecalhos.map((c, i) =>
      celula(c, cols[i], { fundo: CINZA, centro: centrado[i], base: { bold: true, color: TINTA } })
    ),
  });
  // Rede de segurança: se alguma linha vier com mais células que o cabeçalho, o
  // excesso volta para a última coluna em vez de virar uma célula sem largura.
  const ajustar = (r) => (r.length <= n ? [...r, ...Array(n - r.length).fill("")]
                                        : [...r.slice(0, n - 1), r.slice(n - 1).join(" | ")]);
  const linhasCorpo = corpo.map(ajustar).map((r, k) =>
    new TableRow({
      children: r.map((c, i) =>
        celula(c, cols[i], { fundo: k % 2 ? CINZA_CLARO : undefined, centro: centrado[i] })
      ),
    })
  );

  return new Table({
    columnWidths: cols,
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    borders: {
      top: LINHA, bottom: LINHA, left: SEM_BORDA, right: SEM_BORDA,
      insideHorizontal: LINHA, insideVertical: SEM_BORDA,
    },
    rows: [cabecalho, ...linhasCorpo],
  });
}

/* ------------------------------ o parser --------------------------------- */
const linhasMd = MD.split("\n");
const filhos = [];
let i = 0;

// Divide só nos pipes que separam célula: o `\|` escapado é conteúdo
// ("Cronograma \| Logística"), e parti-lo daria uma coluna a mais do que o
// cabeçalho — que é exatamente o erro que apareceu na primeira tentativa.
const celulasDe = (linha) =>
  linha
    .replace(/^\s*\|/, "")
    .replace(/(?<!\\)\|\s*$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

while (i < linhasMd.length) {
  const l = linhasMd[i];

  if (/^\s*$/.test(l)) { i++; continue; }

  // regra horizontal -> quebra leve de seção
  if (/^---+\s*$/.test(l)) {
    filhos.push(new Paragraph({ spacing: { before: 0, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8D8DE" } }, children: [] }));
    i++; continue;
  }

  // tabela
  if (/^\s*\|/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(linhasMd[i + 1] ?? "")) {
    const bloco = [];
    while (i < linhasMd.length && /^\s*\|/.test(linhasMd[i])) { bloco.push(celulasDe(linhasMd[i])); i++; }
    filhos.push(tabela(bloco));
    filhos.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    continue;
  }

  // títulos
  const h = /^(#{1,3})\s+(.*)$/.exec(l);
  if (h) {
    const nivel = h[1].length;
    filhos.push(new Paragraph({
      heading: nivel === 1 ? HeadingLevel.HEADING_1 : nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
      spacing: { before: nivel === 1 ? 360 : 260, after: 140 },
      children: runs(h[2], { bold: true, color: nivel === 1 ? ACENTO : TINTA, size: nivel === 1 ? 30 : nivel === 2 ? 25 : 22 }),
    }));
    i++; continue;
  }

  // item de lista numerada
  const num = /^(\d+)\.\s+(.*)$/.exec(l);
  if (num) {
    let texto = num[2];
    while (i + 1 < linhasMd.length && /^   \S/.test(linhasMd[i + 1])) { texto += " " + linhasMd[++i].trim(); }
    filhos.push(new Paragraph({
      spacing: { before: 40, after: 120, line: 264 },
      indent: { left: 360, hanging: 280 },
      children: [new TextRun({ text: `${num[1]}.  `, font: FONTE, size: CORPO, bold: true, color: ACENTO }), ...runs(texto)],
    }));
    i++; continue;
  }

  // parágrafo (junta as linhas seguintes até uma em branco)
  let texto = l.trim();
  while (i + 1 < linhasMd.length && !/^\s*$/.test(linhasMd[i + 1]) && !/^\s*\|/.test(linhasMd[i + 1])
         && !/^#{1,3}\s/.test(linhasMd[i + 1]) && !/^---+\s*$/.test(linhasMd[i + 1])
         && !/^\d+\.\s/.test(linhasMd[i + 1])) {
    texto += " " + linhasMd[++i].trim();
  }
  // O subtítulo do topo vem inteiro entre asteriscos. Os asteriscos saem AQUI,
  // antes do analisador de formatação em linha: se ficassem, ele casaria o par
  // externo como um itálico só e o `código` de dentro sairia com as crases na
  // tela — foi o que aconteceu na primeira geração.
  const soItalico = /^\*[^*].*\*$/.test(texto);
  const corpoTexto = soItalico ? texto.slice(1, -1) : texto;
  filhos.push(p(corpoTexto, soItalico ? { base: { italics: true, color: TINTA2 } } : {}));
  i++;
}

const doc = new Document({
  creator: "Pólobh · GPX Automação",
  title: "Check-list da Pólobh — ponto a ponto",
  styles: { default: { document: { run: { font: FONTE, size: CORPO, color: TINTA } } } },
  sections: [{
    properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Check-list da Pólobh — ponto a ponto · ", font: FONTE, size: 16, color: TINTA2 }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 16, color: TINTA2 }),
          ],
        })],
      }),
    },
    children: filhos,
  }],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(SAIDA, b);
  console.log(`gerado: ${SAIDA} (${b.length} bytes)`);
});
