/**
 * O contrato em PDF, no padrão dos modelos da Pólobh.
 *
 * Desde 11/11/2026 o contrato sai em PDF, e não mais em Word: é o formato que
 * vai para a pasta do projeto e para a assinatura eletrônica, e um PDF não muda
 * de aparência de um computador para outro.
 *
 * A forma é a dos modelos que a Marisa mandou em 16/09/2026: Arial 9 (aqui a
 * Helvetica, que tem as mesmas medidas), o título numa caixa, cada cláusula
 * anunciada por uma tarja cinza, a qualificação das partes em bloco e as
 * assinaturas no fim.
 *
 * O CONTEÚDO não se decide aqui: vem pronto de `domain/contratoDocumento`, que
 * é função pura da OS e tem teste. Este módulo só desenha — e, como o PDF não
 * tem um motor de layout, traz o seu: quebra de linha, texto justificado,
 * negrito dentro do parágrafo, tabela simples e paginação.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ContratoDocumento, ParteContrato } from "@/domain/contratoDocumento";
import { blocosDaClausula, partirEmDestaques } from "@/domain/contratoDocumento";

/* -------------------------------- medidas -------------------------------- */

const PAGINA = { w: 595.28, h: 841.89 };
const MARGEM = { esq: 42, dir: 42, topo: 58, base: 54 };
const LARGURA = PAGINA.w - MARGEM.esq - MARGEM.dir;
const CORPO = 9;
const ENTRELINHA = 12;
const COL_ROTULO = 105;

const PRETO = rgb(0, 0, 0);
const CINZA_CLARO = rgb(0.94, 0.94, 0.94);
const CINZA_MEDIO = rgb(0.85, 0.85, 0.85);
const GRADE = rgb(0.62, 0.62, 0.62);
const TEXTO_FRACO = rgb(0.35, 0.35, 0.35);

/* --------------------------- texto e medição ---------------------------- */

interface Pedaco {
  t: string;
  b: boolean;
}
interface Palavra {
  pedacos: Pedaco[];
  w: number;
}
interface Linha {
  palavras: Palavra[];
  /** Última linha do parágrafo: não se justifica. */
  fim: boolean;
}

type Fontes = { normal: PDFFont; negrito: PDFFont };

/**
 * Tira o que a fonte padrão do PDF não sabe escrever (ela cobre o alfabeto
 * latino com acentos, o que o português precisa). O resto vira "?" — melhor um
 * sinal no papel do que o PDF inteiro falhando por um caractere de colagem.
 */
function limpar(texto: string, fonte: PDFFont): string {
  const suportados = new Set(fonte.getCharacterSet());
  return Array.from((texto ?? "").replace(/ /g, " ").replace(/[‐‑‒]/g, "-"))
    .map((c) => (c === "\n" || c === "\t" || suportados.has(c.codePointAt(0)!) ? c : "?"))
    .join("");
}

/**
 * Largura de um texto, SEM kerning. A biblioteca mede com kerning (o par "TR",
 * por exemplo, aproxima as letras), mas desenha sem: com a medida menor que o
 * desenho, as palavras encostavam nas vizinhas e os espaços ficavam desiguais.
 * Somar letra a letra dá a largura que o texto realmente ocupa na página.
 */
const largurasPorLetra = new WeakMap<PDFFont, Map<string, number>>();
function larguraSemKerning(fonte: PDFFont, t: string, tam: number): number {
  let cache = largurasPorLetra.get(fonte);
  if (!cache) largurasPorLetra.set(fonte, (cache = new Map()));
  let soma = 0;
  for (const ch of Array.from(t)) {
    let w = cache.get(ch);
    if (w === undefined) cache.set(ch, (w = fonte.widthOfTextAtSize(ch, 1000)));
    soma += w;
  }
  return (soma * tam) / 1000;
}

const largura = (f: Fontes, t: string, negrito: boolean, tam: number) =>
  larguraSemKerning(negrito ? f.negrito : f.normal, t, tam);

/** "Quebra" um texto com negrito em palavras, sem perder o grude entre pedaços ("CONTRATANTE," = bold + vírgula). */
function palavrasDe(runs: Pedaco[], f: Fontes, tam: number): Palavra[] {
  const palavras: Palavra[] = [];
  let atual: Palavra | null = null;
  for (const run of runs) {
    for (const parte of run.t.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) {
        if (atual) palavras.push(atual);
        atual = null;
        continue;
      }
      const pedaco = { t: limpar(parte, f.normal), b: run.b };
      const w = largura(f, pedaco.t, pedaco.b, tam);
      if (atual) {
        atual.pedacos.push(pedaco);
        atual.w += w;
      } else atual = { pedacos: [pedaco], w };
    }
  }
  if (atual) palavras.push(atual);
  return palavras;
}

/** Palavra mais larga que a linha (um e-mail, um link): parte em pedaços que cabem. */
function partirPalavra(p: Palavra, max: number, f: Fontes, tam: number): Palavra[] {
  if (p.w <= max) return [p];
  const saida: Palavra[] = [];
  let atual: Palavra = { pedacos: [], w: 0 };
  for (const ped of p.pedacos) {
    for (const ch of Array.from(ped.t)) {
      const cw = largura(f, ch, ped.b, tam);
      if (atual.w + cw > max && atual.pedacos.length) {
        saida.push(atual);
        atual = { pedacos: [], w: 0 };
      }
      const ult = atual.pedacos[atual.pedacos.length - 1];
      if (ult && ult.b === ped.b) ult.t += ch;
      else atual.pedacos.push({ t: ch, b: ped.b });
      atual.w += cw;
    }
  }
  if (atual.pedacos.length) saida.push(atual);
  return saida;
}

function quebrar(runs: Pedaco[], max: number, f: Fontes, tam: number): Linha[] {
  const espaco = largura(f, " ", false, tam);
  const palavras = palavrasDe(runs, f, tam).flatMap((p) => partirPalavra(p, max, f, tam));
  const linhas: Linha[] = [];
  let cor: Palavra[] = [];
  let w = 0;
  for (const p of palavras) {
    const novo = cor.length ? w + espaco + p.w : p.w;
    if (cor.length && novo > max) {
      linhas.push({ palavras: cor, fim: false });
      cor = [p];
      w = p.w;
    } else {
      cor.push(p);
      w = novo;
    }
  }
  if (cor.length) linhas.push({ palavras: cor, fim: true });
  if (!linhas.length) linhas.push({ palavras: [], fim: true });
  return linhas;
}

/** Os pedaços de um texto com `**negrito**` e com CONTRATANTE/CONTRATADO(A) destacados. */
const pedacosDe = (texto: string, negritoTudo = false): Pedaco[] =>
  partirEmDestaques(texto).map((x) => ({ t: x.texto, b: negritoTudo || x.forte }));

/* -------------------------------- escritor -------------------------------- */

class Escritor {
  doc!: PDFDocument;
  f!: Fontes;
  paginas: PDFPage[] = [];
  pagina!: PDFPage;
  /** Posição vertical corrente (de baixo para cima, como no PDF). */
  y = 0;

  constructor(private readonly cabecalho: string) {}

  static async criar(titulo: string): Promise<Escritor> {
    const e = new Escritor(titulo);
    e.doc = await PDFDocument.create();
    e.doc.setTitle(titulo);
    e.doc.setAuthor("Pólobh");
    e.doc.setCreator("Sistema Pólobh");
    e.f = {
      normal: await e.doc.embedFont(StandardFonts.Helvetica),
      negrito: await e.doc.embedFont(StandardFonts.HelveticaBold),
    };
    e.novaPagina();
    return e;
  }

  /** O cabeçalho de TODA página: o título do contrato (o mesmo do nome do arquivo). */
  novaPagina() {
    this.pagina = this.doc.addPage([PAGINA.w, PAGINA.h]);
    this.paginas.push(this.pagina);
    const tam = 7.5;
    let texto = limpar(this.cabecalho, this.f.normal);
    while (texto.length > 4 && larguraSemKerning(this.f.normal, texto, tam) > LARGURA) texto = texto.slice(0, -2).trimEnd() + "…";
    const y = PAGINA.h - 30;
    this.pagina.drawText(texto, { x: MARGEM.esq, y, size: tam, font: this.f.normal, color: TEXTO_FRACO });
    this.pagina.drawLine({
      start: { x: MARGEM.esq, y: y - 5 },
      end: { x: PAGINA.w - MARGEM.dir, y: y - 5 },
      thickness: 0.5,
      color: GRADE,
    });
    this.y = PAGINA.h - MARGEM.topo;
  }

  /** Garante `h` pontos livres; senão, começa outra página. */
  garantir(h: number) {
    if (this.y - h < MARGEM.base) this.novaPagina();
  }

  espaco(h: number) {
    this.y -= h;
  }

  /** Desenha uma linha de texto (com justificação, se pedida) em `x`, na linha de base `y`. */
  private linha(l: Linha, x: number, y: number, max: number, tam: number, alinhar: "esq" | "just" | "centro" | "dir") {
    const espacoBase = largura(this.f, " ", false, tam);
    const soma = l.palavras.reduce((s, p) => s + p.w, 0);
    const vaos = l.palavras.length - 1;
    let espaco = espacoBase;
    let inicio = x;
    const natural = soma + vaos * espacoBase;
    if (alinhar === "just" && !l.fim && vaos > 0) {
      const maior = (max - soma) / vaos;
      // Sem esticar além do razoável: uma linha curta demais fica à esquerda.
      if (maior <= espacoBase * 3.2) espaco = maior;
    } else if (alinhar === "centro") inicio = x + (max - natural) / 2;
    else if (alinhar === "dir") inicio = x + max - natural;
    let cx = inicio;
    l.palavras.forEach((p, i) => {
      for (const ped of p.pedacos) {
        this.pagina.drawText(ped.t, { x: cx, y, size: tam, font: ped.b ? this.f.negrito : this.f.normal, color: PRETO });
        cx += largura(this.f, ped.t, ped.b, tam);
      }
      if (i < vaos) cx += espaco;
    });
  }

  /** Um parágrafo; até 7 linhas não se parte entre páginas. */
  paragrafo(
    runs: Pedaco[],
    o: { x?: number; w?: number; tam?: number; alinhar?: "esq" | "just" | "centro" | "dir"; depois?: number; antes?: number; manter?: number } = {}
  ) {
    const tam = o.tam ?? CORPO;
    const x = o.x ?? MARGEM.esq;
    const w = o.w ?? LARGURA;
    const lh = tam >= 11 ? tam * 1.3 : ENTRELINHA;
    const linhas = quebrar(runs, w, this.f, tam);
    this.espaco(o.antes ?? 0);
    const total = linhas.length * lh;
    if (linhas.length <= 7) this.garantir(total + (o.manter ?? 0));
    for (const l of linhas) {
      this.garantir(lh);
      this.y -= lh;
      this.linha(l, x, this.y + lh * 0.28, w, tam, o.alinhar ?? "just");
    }
    this.espaco(o.depois ?? 5);
  }

  /** Item de lista: marcador e recuo suspenso. */
  item(runs: Pedaco[]) {
    const recuo = 14;
    const linhas = quebrar(runs, LARGURA - recuo, this.f, CORPO);
    this.garantir(Math.min(linhas.length, 7) * ENTRELINHA);
    linhas.forEach((l, i) => {
      this.garantir(ENTRELINHA);
      this.y -= ENTRELINHA;
      if (i === 0) this.pagina.drawText("•", { x: MARGEM.esq + 3, y: this.y + 3.3, size: CORPO, font: this.f.normal, color: PRETO });
      this.linha(l, MARGEM.esq + recuo, this.y + 3.3, LARGURA - recuo, CORPO, "just");
    });
    this.espaco(3.5);
  }

  /** Subtítulo dentro da cláusula: negrito, com ar em cima, sempre junto do que vem depois. */
  subtitulo(texto: string) {
    this.paragrafo(pedacosDe(texto, true), { antes: 6, depois: 3, alinhar: "esq", manter: ENTRELINHA * 4 });
  }

  /** Caixa cinza de largura inteira — o título do contrato e as tarjas de cláusula. */
  caixa(linhasDeTexto: { runs: Pedaco[]; tam: number; alinhar: "esq" | "centro" }[], manter = 0) {
    const pad = 5;
    const blocos = linhasDeTexto.map((t) => ({ ...t, linhas: quebrar(t.runs, LARGURA - 2 * pad, this.f, t.tam) }));
    const h = blocos.reduce((s, b) => s + b.linhas.length * (b.tam >= 11 ? b.tam * 1.3 : ENTRELINHA), 0) + 2 * pad;
    this.garantir(h + manter);
    this.pagina.drawRectangle({
      x: MARGEM.esq, y: this.y - h, width: LARGURA, height: h,
      color: CINZA_CLARO, borderColor: PRETO, borderWidth: 0.7,
    });
    let cy = this.y - pad;
    for (const b of blocos) {
      const lh = b.tam >= 11 ? b.tam * 1.3 : ENTRELINHA;
      for (const l of b.linhas) {
        cy -= lh;
        this.linha(l, MARGEM.esq + pad, cy + lh * 0.28, LARGURA - 2 * pad, b.tam, b.alinhar);
      }
    }
    this.y -= h;
  }

  /** A tabela de qualificação de uma das partes: rótulos numa coluna, valores em outra. */
  parte(p: ParteContrato) {
    const pad = 3.5;
    const linhasDaParte: [string, string][] = [
      ["Nome / Razão Social", p.razaoSocial],
      ["CNPJ / CPF", p.cnpjCpf],
      ["Insc. Estadual", p.inscricaoEstadual],
      ["Telefone", p.telefone],
      ["Endereço", p.endereco],
    ];
    const larguraValor = LARGURA - COL_ROTULO;
    const medidas = linhasDaParte.map(([r, v]) => {
      const ls = quebrar([{ t: v, b: true }], larguraValor - 2 * pad, this.f, CORPO);
      return { r, ls, h: Math.max(ls.length, 1) * ENTRELINHA + 2 * pad - 2 };
    });
    // O destaque pedido para o "Neste ato…": maior, sem itálico, em negrito.
    const aviso = quebrar(
      [{ t: "Neste ato representando(a) em conformidade com seu contrato ou estatuto social.", b: true }],
      LARGURA - 2 * pad, this.f, 10
    );
    const hAviso = aviso.length * 13 + 2 * pad - 2;
    const hCab = ENTRELINHA + 2 * pad - 2;
    const total = hCab + medidas.reduce((s, m) => s + m.h, 0) + hAviso;
    this.garantir(total);

    let ty = this.y;
    const celula = (x: number, w: number, h: number, fundo?: ReturnType<typeof rgb>) =>
      this.pagina.drawRectangle({ x, y: ty - h, width: w, height: h, color: fundo, borderColor: GRADE, borderWidth: 0.5 });

    celula(MARGEM.esq, LARGURA, hCab, CINZA_MEDIO);
    this.pagina.drawText(limpar(p.papel, this.f.negrito), { x: MARGEM.esq + pad, y: ty - hCab + pad + 1, size: CORPO, font: this.f.negrito, color: PRETO });
    ty -= hCab;
    for (const m of medidas) {
      celula(MARGEM.esq, COL_ROTULO, m.h, CINZA_CLARO);
      celula(MARGEM.esq + COL_ROTULO, larguraValor, m.h);
      this.pagina.drawText(limpar(m.r, this.f.normal), { x: MARGEM.esq + pad, y: ty - ENTRELINHA + 3.3 - 1, size: CORPO, font: this.f.normal, color: PRETO });
      m.ls.forEach((l, i) => this.linha(l, MARGEM.esq + COL_ROTULO + pad, ty - (i + 1) * ENTRELINHA + 3.3 - 1, larguraValor - 2 * pad, CORPO, "esq"));
      ty -= m.h;
    }
    celula(MARGEM.esq, LARGURA, hAviso);
    aviso.forEach((l, i) => this.linha(l, MARGEM.esq + pad, ty - (i + 1) * 13 + 3.6 - 1, LARGURA - 2 * pad, 10, "esq"));
    this.y = ty - hAviso;
  }

  /** O fecho, a cidade e as quatro assinaturas — sempre juntos na mesma página. */
  fechamento(c: ContratoDocumento) {
    const colunas = 2;
    const folga = 28;
    const wCol = (LARGURA - folga) / colunas;
    const fecho = quebrar(pedacosDe(c.fecho), LARGURA, this.f, CORPO);
    const alturaFecho = fecho.length * ENTRELINHA + 6;
    const alturaAssin = 62;
    const alturaTest = 62;
    this.espaco(10);
    this.garantir(alturaFecho + ENTRELINHA + 14 + alturaAssin + alturaTest);

    for (const l of fecho) {
      this.y -= ENTRELINHA;
      this.linha(l, MARGEM.esq, this.y + 3.3, LARGURA, CORPO, "just");
    }
    this.espaco(10);
    this.y -= ENTRELINHA;
    this.pagina.drawText(limpar(c.cidadeData, this.f.normal), { x: MARGEM.esq, y: this.y + 3.3, size: CORPO, font: this.f.normal, color: PRETO });
    this.espaco(14);

    const assinar = (x: number, topo: number, linhas: { t: string; negrito?: boolean }[]) => {
      const yl = topo - 30;
      this.pagina.drawLine({ start: { x, y: yl }, end: { x: x + wCol, y: yl }, thickness: 0.7, color: PRETO });
      linhas.forEach((ln, i) => {
        const fonte = ln.negrito ? this.f.negrito : this.f.normal;
        const t = limpar(ln.t, fonte);
        const w = larguraSemKerning(fonte, t, CORPO);
        this.pagina.drawText(t, { x: x + Math.max(0, (wCol - w) / 2), y: yl - 11 * (i + 1), size: CORPO, font: fonte, color: PRETO });
      });
    };
    const xE = MARGEM.esq;
    const xD = MARGEM.esq + wCol + folga;
    assinar(xE, this.y, [{ t: c.assinaturas[0].papel, negrito: true }, { t: c.assinaturas[0].nome }]);
    assinar(xD, this.y, [{ t: c.assinaturas[1].papel, negrito: true }, { t: c.assinaturas[1].nome }]);
    this.y -= alturaAssin;
    const test = (i: number) => {
      const t = c.testemunhas[i];
      return [{ t: "TESTEMUNHA", negrito: true }, { t: (t.nome || "").toUpperCase() }, { t: t.cpf ? `CPF: ${t.cpf}` : "CPF:" }];
    };
    assinar(xE, this.y, test(0));
    assinar(xD, this.y, test(1));
    this.y -= alturaTest;
  }

  /** "pág X de Y" em toda página — só dá para escrever o Y no fim. */
  rodapes() {
    const total = this.paginas.length;
    this.paginas.forEach((p, i) => {
      const t = `pág ${i + 1} de ${total}`;
      const w = larguraSemKerning(this.f.normal, t, 8);
      p.drawText(t, { x: PAGINA.w - MARGEM.dir - w, y: 28, size: 8, font: this.f.normal, color: TEXTO_FRACO });
    });
  }
}

/* --------------------------------- o PDF --------------------------------- */

/** O documento inteiro, em bytes de PDF. */
export async function gerarContratoPdf(c: ContratoDocumento): Promise<Uint8Array> {
  const e = await Escritor.criar(c.tituloDocumento);

  // Só o título: a linha "OS (02) | Data …" saiu a pedido da Marisa (12/11/2026).
  e.caixa([{ runs: [{ t: c.titulo, b: true }], tam: 15, alinhar: "centro" }]);
  e.espaco(8);
  e.parte(c.contratante);
  e.espaco(8);
  e.parte(c.contratado);

  for (const cl of c.clausulas) {
    e.espaco(10);
    // A tarja nunca fica sozinha no pé da página: leva junto o primeiro bloco da
    // cláusula (um subtítulo e o primeiro item, ou as primeiras linhas).
    e.caixa([{ runs: [{ t: cl.titulo, b: true }], tam: CORPO, alinhar: "esq" }], ENTRELINHA * 6.5);
    e.espaco(7);
    for (const b of blocosDaClausula(cl.chave, cl.paragrafos)) {
      if (b.tipo === "subtitulo") e.subtitulo(b.texto);
      else if (b.tipo === "item") e.item(pedacosDe(b.texto));
      else {
        // O fecho dos valores não se parte: "Valor Total a Pagar", "Forma de Pagamento"
        // e as observações gerais ficam na mesma página.
        const dosValores = /^\*\*(Valor Total a Pagar|Forma de Pagamento)/.test(b.texto);
        const total = /^\*\*Valor Total a Pagar/.test(b.texto);
        e.paragrafo(pedacosDe(b.texto), {
          antes: b.antes ? 10 : 0,
          depois: dosValores ? 2 : 5,
          manter: total ? ENTRELINHA * 3 : dosValores ? ENTRELINHA * 2 : 0,
        });
      }
    }
  }

  e.fechamento(c);
  e.rodapes();
  return e.doc.save();
}
