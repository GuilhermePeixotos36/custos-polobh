/**
 * A OS em arquivo PDF (27/11/2026) — o que vai para a pasta do projeto e para o
 * e-mail do fornecedor quando a OS é emitida.
 *
 * Até aqui "Baixar PDF" era a janela de impressão do navegador: não havia
 * arquivo que o sistema pudesse guardar. Este módulo desenha o mesmo papel da
 * visualização em tela (`components/print/OsDocumento`), com texto de verdade —
 * dá para copiar o CNPJ e os dados bancários.
 *
 * O CONTEÚDO não se decide aqui: vem de `domain/osDocumento`, o mesmo que a tela
 * usa. Aqui é só o desenho: quebra de linha, tabelas e paginação.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { BlocoOs, OsDocumentoModelo } from "@/domain/osDocumento";

const PAGINA = { w: 595.28, h: 841.89 };
const MARGEM = { esq: 40, dir: 40, topo: 40, base: 46 };
const LARGURA = PAGINA.w - MARGEM.esq - MARGEM.dir;
const CORPO = 9;
const ENTRELINHA = 11.5;
const COL_ROTULO = 128;
const RESPIRO = { x: 8, y: 3.5 };

const TINTA = rgb(0.1, 0.11, 0.13);
const FRACO = rgb(0.42, 0.43, 0.47);
const LINHA = rgb(0.88, 0.89, 0.91);
const FUNDO_ROTULO = rgb(0.95, 0.95, 0.95);
const FUNDO_SECAO = rgb(0.753, 0.753, 0.753);
const GRAFITE = rgb(0.35, 0.35, 0.35);
const BRANCO = rgb(1, 1, 1);
const LARANJA = rgb(0.949, 0.51, 0.051);
const AMBAR = rgb(1, 0.753, 0);
const FUNDO_AMBAR = rgb(1, 0.973, 0.902);

/** Tira o que a fonte padrão do PDF não escreve; o resto vira "?" em vez de derrubar o arquivo. */
function limpar(texto: string, fonte: PDFFont): string {
  const ok = new Set(fonte.getCharacterSet());
  return Array.from((texto ?? "").replace(/ /g, " ").replace(/[‐-‒]/g, "-").replace(/\r/g, ""))
    .map((c) => (c === "\n" ? c : c === "\t" ? " " : ok.has(c.codePointAt(0)!) ? c : "?"))
    .join("");
}

/** Quebra o texto em linhas que cabem em `max`, respeitando as quebras que já vêm nele. */
function quebrar(texto: string, fonte: PDFFont, tam: number, max: number): string[] {
  const linhas: string[] = [];
  const mede = (t: string) => fonte.widthOfTextAtSize(t, tam);
  for (const paragrafo of limpar(texto, fonte).split("\n")) {
    let atual = "";
    for (let palavra of paragrafo.split(/ +/).filter(Boolean)) {
      // Palavra mais larga que a coluna (um link, um e-mail): parte em pedaços.
      while (mede(palavra) > max) {
        let n = palavra.length - 1;
        while (n > 1 && mede(palavra.slice(0, n)) > max) n -= 1;
        if (atual) linhas.push(atual);
        atual = "";
        linhas.push(palavra.slice(0, n));
        palavra = palavra.slice(n);
      }
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && mede(tentativa) > max) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    linhas.push(atual);
  }
  return linhas.length ? linhas : [""];
}

class Folha {
  paginas: PDFPage[] = [];
  pagina!: PDFPage;
  y = 0;

  constructor(
    readonly doc: PDFDocument,
    readonly normal: PDFFont,
    readonly negrito: PDFFont
  ) {
    this.nova();
  }

  nova() {
    this.pagina = this.doc.addPage([PAGINA.w, PAGINA.h]);
    this.paginas.push(this.pagina);
    this.y = PAGINA.h - MARGEM.topo;
  }

  get sobra() {
    return this.y - MARGEM.base;
  }

  /** Garante `altura` livre na página; sem ela, vai para a próxima. */
  garantir(altura: number) {
    if (this.sobra < altura) this.nova();
  }

  texto(t: string, x: number, y: number, o: { fonte?: PDFFont; tam?: number; cor?: ReturnType<typeof rgb> } = {}) {
    if (!t) return;
    this.pagina.drawText(t, { x, y, size: o.tam ?? CORPO, font: o.fonte ?? this.normal, color: o.cor ?? TINTA });
  }

  retangulo(x: number, y: number, w: number, h: number, cor: ReturnType<typeof rgb>) {
    this.pagina.drawRectangle({ x, y, width: w, height: h, color: cor });
  }

  traco(x1: number, x2: number, y: number, cor = LINHA, espessura = 0.6) {
    this.pagina.drawLine({ start: { x: x1, y }, end: { x: x2, y }, color: cor, thickness: espessura });
  }

  cabecalho(logo: PDFImage | null) {
    const alto = 26;
    if (logo) {
      const w = (logo.width / logo.height) * alto;
      this.pagina.drawImage(logo, { x: MARGEM.esq, y: this.y - alto, width: w, height: alto });
    }
    const titulo = "Ordem de Serviço";
    const tam = 13;
    this.texto(titulo, PAGINA.w - MARGEM.dir - this.negrito.widthOfTextAtSize(titulo, tam), this.y - alto + 8, { fonte: this.negrito, tam });
    this.y -= alto + 8;
    this.traco(MARGEM.esq, PAGINA.w - MARGEM.dir, this.y, LARANJA, 1.6);
    this.y -= 2;
  }

  secao(titulo: string) {
    const alto = 17;
    // A faixa nunca fica sozinha no pé da página.
    this.garantir(alto + 12 + ENTRELINHA * 3);
    this.y -= 10;
    this.retangulo(MARGEM.esq, this.y - alto, LARGURA, alto, FUNDO_SECAO);
    this.texto(limpar(titulo.toLocaleUpperCase("pt-BR"), this.negrito), MARGEM.esq + RESPIRO.x, this.y - alto + 5.5, { fonte: this.negrito });
    this.y -= alto;
  }

  /** Linha "rótulo | valor". Valor comprido continua na página seguinte, com o rótulo repetido. */
  lv(label: string, valor: string) {
    const rotulo = quebrar(label, this.negrito, CORPO, COL_ROTULO - RESPIRO.x * 2);
    const linhas = quebrar(valor, this.normal, CORPO, LARGURA - COL_ROTULO - RESPIRO.x * 2);
    let i = 0;
    let primeira = true;
    do {
      const minimo = Math.max(primeira ? rotulo.length : 1, 1);
      this.garantir(minimo * ENTRELINHA + RESPIRO.y * 2);
      const cabem = Math.max(Math.floor((this.sobra - RESPIRO.y * 2) / ENTRELINHA), 1);
      const pedaco = linhas.slice(i, i + cabem);
      const rot = primeira ? rotulo : [];
      const n = Math.max(pedaco.length, rot.length, 1);
      const alto = n * ENTRELINHA + RESPIRO.y * 2;
      this.retangulo(MARGEM.esq, this.y - alto, COL_ROTULO, alto, FUNDO_ROTULO);
      rot.forEach((t, k) => this.texto(t, MARGEM.esq + RESPIRO.x, this.y - RESPIRO.y - ENTRELINHA * (k + 1) + 3, { fonte: this.negrito }));
      pedaco.forEach((t, k) => this.texto(t, MARGEM.esq + COL_ROTULO + RESPIRO.x, this.y - RESPIRO.y - ENTRELINHA * (k + 1) + 3));
      this.y -= alto;
      this.traco(MARGEM.esq, PAGINA.w - MARGEM.dir, this.y);
      i += pedaco.length;
      primeira = false;
    } while (i < linhas.length);
  }

  tabela(b: Extract<BlocoOs, { t: "tabela" }>) {
    const escuro = b.estilo === "escuro";
    const tam = 8.5;
    const entre = 10.5;
    const px = escuro ? 6 : RESPIRO.x;
    const fixa = b.colunas.reduce((s, c) => s + (c.largura ?? 0), 0);
    const livres = b.colunas.filter((c) => !c.largura).length || 1;
    const larguras = b.colunas.map((c) => (c.largura ?? Math.max(1 - fixa, 0.1) / livres) * LARGURA);
    const xs = larguras.map((_, i) => MARGEM.esq + larguras.slice(0, i).reduce((s, w) => s + w, 0));

    const linha = (celulas: string[], o: { fonte?: PDFFont; fundo?: ReturnType<typeof rgb>; cor?: ReturnType<typeof rgb>; borda?: boolean; destaque?: boolean }) => {
      const quebradas = celulas.map((t, i) => quebrar(t, i === 0 && o.destaque ? this.negrito : o.fonte ?? this.normal, tam, larguras[i] - px * 2));
      const alto = Math.max(...quebradas.map((q) => q.length), 1) * entre + 7;
      this.garantir(alto);
      if (o.fundo) this.retangulo(MARGEM.esq, this.y - alto, LARGURA, alto, o.fundo);
      quebradas.forEach((q, i) => {
        const fonte = i === 0 && o.destaque ? this.negrito : o.fonte ?? this.normal;
        q.forEach((t, k) => {
          const x = b.colunas[i]?.direita ? xs[i] + larguras[i] - px - fonte.widthOfTextAtSize(t, tam) : xs[i] + px;
          this.texto(t, x, this.y - 3.5 - entre * (k + 1) + 3, { fonte, tam, cor: o.cor });
        });
      });
      this.y -= alto;
      if (o.borda) this.traco(MARGEM.esq, PAGINA.w - MARGEM.dir, this.y);
    };

    this.garantir(60);
    linha(b.colunas.map((c) => c.titulo), {
      fonte: this.negrito,
      fundo: escuro ? GRAFITE : FUNDO_ROTULO,
      cor: escuro ? BRANCO : TINTA,
      borda: !escuro,
    });
    if (!b.linhas.length && b.vazio) linha([b.vazio, ...b.colunas.slice(1).map(() => "")], { cor: FRACO });
    for (const l of b.linhas) linha(l, { borda: true, destaque: b.primeiraEmDestaque });
    if (b.rodape) linha(b.rodape, { fonte: this.negrito });
  }

  destaque(titulo: string, texto: string) {
    const linhas = quebrar(texto, this.normal, 8.5, LARGURA - RESPIRO.x * 2);
    const alto = (linhas.length + 1) * 10.5 + 12;
    this.garantir(alto + 6);
    this.y -= 6;
    this.pagina.drawRectangle({ x: MARGEM.esq, y: this.y - alto, width: LARGURA, height: alto, color: FUNDO_AMBAR, borderColor: AMBAR, borderWidth: 1.4 });
    this.texto(limpar(titulo.toLocaleUpperCase("pt-BR"), this.negrito), MARGEM.esq + RESPIRO.x, this.y - 14, { fonte: this.negrito, tam: 8 });
    linhas.forEach((t, k) => this.texto(t, MARGEM.esq + RESPIRO.x, this.y - 14 - 10.5 * (k + 1), { tam: 8.5 }));
    this.y -= alto;
  }

  assinaturas(fornecedor: string) {
    this.garantir(70);
    this.y -= 44;
    const meio = LARGURA / 2;
    const w = meio - 16;
    const escreve = (t: string, x: number) => {
      this.traco(x, x + w, this.y, TINTA, 0.7);
      quebrar(t, this.normal, 8.5, w).forEach((l, k) => this.texto(l, x, this.y - 11 - 10.5 * k, { tam: 8.5 }));
    };
    escreve("Pólobh Promoções", MARGEM.esq);
    escreve(`${fornecedor} — Data: ____ ____ ______`, MARGEM.esq + meio + 16);
  }

  rodapes() {
    const total = this.paginas.length;
    this.paginas.forEach((p, i) => {
      const t = `pág ${i + 1} de ${total}`;
      p.drawText(t, { x: PAGINA.w - MARGEM.dir - this.normal.widthOfTextAtSize(t, 8), y: 24, size: 8, font: this.normal, color: FRACO });
    });
  }
}

/** O logo da casa, se der para buscar; sem ele o PDF sai do mesmo jeito. */
async function buscarLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    if (typeof fetch !== "function") return null;
    const r = await fetch("/polobh-logo.png");
    if (!r.ok) return null;
    return await doc.embedPng(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** A OS inteira, em bytes de PDF. `titulo` é o nome da OS (vira o título do arquivo). */
export async function gerarOsPdf(modelo: OsDocumentoModelo, titulo: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(titulo);
  doc.setAuthor("Pólobh");
  doc.setCreator("Sistema Pólobh");
  const folha = new Folha(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  folha.cabecalho(await buscarLogo(doc));
  for (const b of modelo.blocos) {
    if (b.t === "secao") folha.secao(b.titulo);
    else if (b.t === "lv") folha.lv(b.label, b.valor);
    else if (b.t === "tabela") folha.tabela(b);
    else folha.destaque(b.titulo, b.texto);
  }
  folha.assinaturas(modelo.assinaturaFornecedor);
  folha.rodapes();
  return doc.save();
}
