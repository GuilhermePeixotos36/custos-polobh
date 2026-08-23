/**
 * Geração da EC em Excel. Recriamos o layout da planilha real em /reference
 * com ExcelJS (que aplica estilos — diferente do SheetJS), usando a paleta
 * Pólobh. A tabela de custos é dinâmica, por isso montamos sob medida.
 */
import ExcelJS from "exceljs";
import type { Ec } from "@/data/types";
import { calcularTotais, rotuloTaxa, tituloEc } from "@/domain/calc";
import { dataBR } from "@/lib/format";
import {
  COR, fill, thin, gradeAuto, baixar, salvarComPicker, carregarLogo, encaixarLogo,
  REALCE, regraRealce,
  linhasVisuais, alturaParaLinhas, ALTURA_MAX_LINHA, FONT_BOLD, FONT_LIGHT,
} from "./shared";
import { nomeEcExcel } from "./nomeEc";

/**
 * Colunas de status/fornecedor/documentação com destaque no CABEÇALHO.
 *
 * Nos modelos de 2026 o preenchimento existe só na linha de títulos — as linhas
 * de dados abaixo ficam limpas. (O "Culturais" pinta também K, L e M; o
 * "Corporativos" e o modelo antigo param em J. Seguimos a maioria: E–J.)
 */
const COLS_DESTAQUE = new Set(["E", "F", "G", "H", "I", "J"]);

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const ALTURA_MAX = ALTURA_MAX_LINHA;

/** Formato de moeda dos totais (barra invertida = espaço fixo após o R$). */
const FORMATO_MOEDA = '"R$"\ #,##0.00';

/** Formato das linhas de item: igual ao dos totais, com a variante negativa. */
const FORMATO_MOEDA_ITEM = '"R$"\ #,##0.00;\-"R$"\ #,##0.00';

/** Formato dos fechamentos (Valor total bruto e Faturamentos) — sem o "R$". */
const FORMATO_TOTAL_FINAL = "#,##0.00";

/** Índices das colunas de dinheiro na linha de item (C e D). */
const MOEDA = new Set([2, 3]);

/**
 * Alinhamento horizontal de cada coluna da linha de item, medido célula a célula
 * nos modelos de 2026 (Culturais e Corporativos usam o mesmo).
 *
 * Item e Descrição à esquerda, os dois valores em "distribuído" (é assim na
 * planilha da casa, não é engano de digitação) e toda a faixa de status e
 * documentação centrada.
 */
const ALINHAMENTO_ITEM: Record<string, "left" | "center" | "distributed"> = {
  A: "left",         // Item
  B: "left",         // Descrição
  C: "distributed",  // Pólobh (moeda)
  D: "distributed",  // Cliente (moeda)
  E: "center",       // Status Aprovação
  F: "center",       // Fornecedor (Razão Social)
  G: "center",       // Fornecedor (CNPJ)
  H: "center",       // Fatura ou Nota Fiscal
  I: "center",       // Código Serviço
  J: "center",       // Pedido de Compra
  K: "center",       // OS
  L: "center",       // Contrato
};

/** Altura mínima da linha de item nos modelos de 2026. */
const ALTURA_ITEM = 16.5;

/** Corpo da EC: 11pt, como nos modelos (a página se ajusta por fitToWidth). */
const PT_CORPO = 11;

/** Coluna "Item": 12pt em negrito nos modelos, um ponto acima do resto. */
const PT_ITEM = 12;

/** Título fixo do documento — o número/título da EC vai na linha "Número EC | Orçamento". */
const TITULO_DOCUMENTO = "Estimativa de Custos | Proposta Comercial";

export type ModeloEcExcel = "financeiro" | "completa";

/** Converte o HTML do rich-text (Descrição Completa) numa lista de linhas de texto. */
function htmlParaLinhas(html: string): string[] {
  if (!html) return [];
  const txt = html
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  const linhas = txt.split(/\n/).map((l) => l.trim());
  while (linhas[0] === "") linhas.shift();
  while (linhas.at(-1) === "") linhas.pop();
  return linhas;
}

export async function criarEcExcelBuffer(
  ec: Ec,
  modelo: ModeloEcExcel = "completa"
): Promise<{ buffer: ArrayBuffer; nome: string }> {
  const completa = modelo === "completa";
  const ultimaColuna = completa ? "L" : "D";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("EC", {
    pageSetup: {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });

  // Larguras lidas do <cols> dos modelos de 2026 (os dois arquivos são iguais).
  // O modelo "financeiro" fica com as quatro primeiras — é o recorte que vai
  // para o cliente, sem a faixa de documentação.
  const widths = completa
    ? [29.75, 72.875, 15.625, 15.625, 14.75, 12.25, 10.125, 9.5, 13.5, 16.125, 12.875, 12.875]
    : [29.75, 72.875, 15.625, 15.625];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Corpo em 11pt nos dois modelos, como na planilha da casa. As 13 colunas
  // cabem na página pelo fitToWidth do pageSetup, sem encolher a fonte.
  const PT = PT_CORPO;

  const t = calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos);
  /** Largura somada de um intervalo de colunas — base para estimar a altura das linhas. */
  const larguraDe = (colInicio: string, colFim: string) => {
    const i = COLS.indexOf(colInicio);
    const f = COLS.indexOf(colFim);
    return widths.slice(i, f + 1).reduce((s, w) => s + w, 0);
  };
  /** Altura da linha de item: 15pt (modelo) quando cabe em uma linha visual. */
  const alturaItem = (item: string, descricao: string) => {
    const linhas = Math.max(linhasVisuais(item, larguraDe("A", "A")), linhasVisuais(descricao, larguraDe("B", "B")));
    return linhas <= 1 ? ALTURA_ITEM : alturaParaLinhas(linhas, PT + 3);
  };
  let r = 1;

  // ---------- Cabeçalho / logo ----------
  // Sem fundo colorido (a EC original da Pólobh não tem barra atrás do título).
  // O título é só "Estimativa de Custos | Proposta Comercial", em preto e negrito;
  // o número/título da EC aparece abaixo, na linha "Número EC | Orçamento".
  // Uma única linha alta (100pt no modelo): logo na coluna A, título mesclado em
  // B:última, alinhado à direita e centrado na vertical.
  ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
  const titulo = ws.getCell(`B${r}`);
  titulo.value = TITULO_DOCUMENTO;
  titulo.font = { name: FONT_BOLD, bold: true, size: 16, color: { argb: COR.ink } };
  titulo.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
  ws.getRow(r).height = 100;

  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo.buffer as unknown as ExcelJS.Buffer, extension: "png" });
    // Escala pela proporção real do arquivo (inclusive a versão com slogan, bem
    // mais larga que alta) — tamanho fixo achatava o desenho.
    //
    // A caixa ocupa a altura útil da linha de cabeçalho (100pt ≈ 133px). Como a
    // logo é 2,39x mais larga que alta — a mesma proporção da imagem embutida na
    // EC original —, ela transborda a coluna A (≈180px) e avança sobre a B. É o
    // comportamento do modelo: o título em B é alinhado à direita justamente
    // para deixar essa faixa livre. Limitar a caixa à coluna A era o que fazia a
    // logo sair pequena, com a metade de baixo da linha vazia.
    const ext = encaixarLogo(logo, { largura: 300, altura: 120 });
    ws.addImage(id, { tl: { col: 0.15, row: r - 0.9 }, ext });
  }
  r += 1;

  // ---------- Meta ----------
  const meta = (label: string, valor: string) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", wrapText: true };
    ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
    ws.getCell(`B${r}`).value = valor;
    ws.getCell(`B${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    ws.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.getRow(r).height = 20.2;
    r++;
  };
  meta("Data:", dataBR(new Date().toISOString())); // data de geração (modelo usa =HOJE())
  // Título completo (não o número técnico abreviado) — era aqui que o título do
  // projeto aparecia cortado, pois numeroEc() trunca cliente/projeto para caber no ID técnico.
  meta("Número EC | Orçamento:", tituloEc(ec));

  // ---------- Seção util ----------
  // "gray" = CLIENTE/PROJETO (cinza do modelo original); "gold" = ESTIMATIVA DE CUSTOS (destaque âmbar).
  const secao = (txt: string, variante: "gray" | "gold" = "gray") => {
    ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    c.fill = fill(variante === "gold" ? COR.gold : COR.sectionGray);
    // Barras de seção vêm CENTRADAS no modelo original (não alinhadas à esquerda).
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    // A faixa mesclada precisa da borda em todas as colunas, não só na primeira.
    for (const col of COLS.slice(0, completa ? 12 : 4)) {
      const cc = ws.getCell(`${col}${r}`);
      cc.border = gradeAuto;
      cc.fill = fill(variante === "gold" ? COR.gold : COR.sectionGray);
    }
    // Alturas do modelo original: 15pt na faixa dourada, 24pt nas faixas cinzas.
    ws.getRow(r).height = variante === "gold" ? 15 : 24;
    r++;
  };
  const larguraValor = larguraDe("B", ultimaColuna);
  const linhaLV = (label: string, valor: string) => {
    ws.getCell(`A${r}`).value = label;
    // Rótulo e valor em negrito, centrados na vertical — como no modelo original.
    ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", wrapText: true };
    ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
    ws.getCell(`B${r}`).value = valor;
    ws.getCell(`B${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    ws.getCell(`B${r}`).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    // Altura pelo conteúdo (mínimo 20,2 do modelo): representante e endereço têm
    // várias linhas e ficavam cortados.
    const linhas = linhasVisuais(valor, larguraValor);
    ws.getRow(r).height = linhas <= 1 ? 20.2 : alturaParaLinhas(linhas, PT + 3);
    r++;
  };

  // ---------- Cliente ----------
  secao("CLIENTE");
  const cli = ec.cliente;
  linhaLV("Cliente:", cli.nome);
  linhaLV("Razão Social:", cli.razaoSocial);
  linhaLV("Endereço:", cli.endereco);
  linhaLV("CNPJ/CPF:", cli.cnpjCpf);
  linhaLV("Inscrição Estadual:", cli.inscricaoEstadual);
  linhaLV("Inscrição Municipal:", cli.inscricaoMunicipal);
  linhaLV(
    "Representante:",
    [cli.representante.nome, cli.representante.cargo, cli.representante.telefones, cli.representante.email]
      .filter(Boolean)
      .join("\n")
  );

  // ---------- Projeto ----------
  secao("PROJETO");
  const p = ec.projeto;
  linhaLV("Título:", p.titulo);
  linhaLV("Local:", `${p.local}${p.enderecoLocal ? " — " + p.enderecoLocal : ""}`);
  linhaLV("Nº Participantes:", String(p.participantes ?? ""));
  linhaLV("Produtora Responsável:", p.produtoraResponsavel);
  linhaLV("Pré-Evento:", dataBR(p.preEvento));
  linhaLV("Evento:", `${dataBR(p.evento)}${p.horario ? " · " + p.horario : ""}`);
  linhaLV("Pós-Evento:", dataBR(p.posEvento));
  linhaLV("Roteiro:", p.roteiro);

  // ---------- Tabela de custos ----------
  secao("ESTIMATIVA DE CUSTOS", "gold");
  const hr = r;
  // Rótulos exatamente como nos modelos de 2026, inclusive as quebras de linha
  // de "Fornecedor" e "Fatura ou Nota Fiscal".
  const headers: [string, string][] = completa
    ? [
        ["A", "Item"], ["B", "Descrição"], ["C", "Pólobh"], ["D", "Cliente"],
        ["E", "Status Aprovação"], ["F", "Fornecedor\n(Razão Social)"], ["G", "Fornecedor\n(CNPJ)"],
        ["H", "Fatura ou\nNota Fiscal"], ["I", "Código Serviço"], ["J", "Pedido de Compra"],
        ["K", "OS"], ["L", "Contrato"],
      ]
    // Modelo financeiro = as 4 colunas do arquivo original, com "Descrição" em B
    // (não mesclada com A — a descrição tem coluna própria lá).
    : [["A", "Item"], ["B", "Descrição"], ["C", "Pólobh"], ["D", "Cliente"]];
  // Alinhamento do cabeçalho medido no modelo: "Item" e "Descrição" à esquerda,
  // os dois valores em "distribuído" (como nas próprias linhas de item) e a
  // faixa de status/documentação centrada.
  headers.forEach(([col, h]) => {
    const c = ws.getCell(`${col}${hr}`);
    c.value = h;
    c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    // O destaque de cor existe só aqui no cabeçalho — as linhas de dados abaixo
    // ficam sem preenchimento, como nos modelos de 2026.
    if (completa && COLS_DESTAQUE.has(col)) c.fill = fill(COR.destaqueCabecalho);
    c.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: completa ? ALINHAMENTO_ITEM[col] ?? "center" : col === "C" || col === "D" ? "distributed" : "left",
    };
    c.border = gradeAuto;
  });
  ws.getRow(hr).height = 30;
  r++;
  const itemStart = r; // início do intervalo das linhas de custo (p/ fórmulas)
  /** Linhas que são de fato itens — só elas recebem o realce condicional. */
  const linhasDeItem: number[] = [];

  // agrupar por GRUPO (itens ocultos ficam de fora do Excel)
  const grupos = new Map<string, typeof ec.linhas>();
  for (const l of [...ec.linhas].filter((l) => !l.oculto).sort((a, b) => a.ordem - b.ordem)) {
    const g = l.grupo || "GERAL";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(l);
  }

  /** Escreve a Descrição Completa (e observações) em linhas extras mescladas A:L,
   *  quebrando em quantas linhas forem necessárias sem estourar a altura de 409. */
  const escreverBlocoTexto = (titulo: string, linhasTxt: string[]) => {
    if (!linhasTxt.length) return;
    // Largura real do bloco mesclado (A:L), em unidades de coluna do Excel.
    const larguraBloco = larguraDe("A", ultimaColuna);
    const visuais = (s: string) => linhasVisuais(s, larguraBloco);
    const LINHAS_ALVO = Math.floor((ALTURA_MAX - 8) / 13); // ~30 linhas visuais por célula
    let buffer: string[] = [];
    let acc = 0;
    const flush = () => {
      if (!buffer.length) return;
      ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
      const c = ws.getCell(`A${r}`);
      c.value = buffer.join("\n");
      c.font = { name: FONT_LIGHT, size: PT - 1.5, color: { argb: COR.ink2 } };
      c.alignment = { wrapText: true, vertical: "top" };
      c.border = thin;
      ws.getRow(r).height = Math.min(ALTURA_MAX, acc * 13 + 8);
      r++;
      buffer = [];
      acc = 0;
    };
    // rótulo do bloco
    ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
    const cab = ws.getCell(`A${r}`);
    cab.value = titulo;
    cab.font = { name: FONT_LIGHT, size: PT - 2, bold: true, italic: true, color: { argb: COR.ink2 } };
    cab.border = thin;
    r++;
    for (const l of linhasTxt) {
      const v = visuais(l);
      if (acc + v > LINHAS_ALVO && buffer.length) flush();
      buffer.push(l);
      acc += v;
    }
    flush();
  };

  for (const [grupo, linhas] of grupos) {
    ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
    const gc = ws.getCell(`A${r}`);
    gc.value = grupo;
    gc.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    gc.fill = fill(COR.sectionGray);
    // Nome do grupo vem CENTRADO na faixa, como no modelo original.
    gc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    // grade em toda a faixa do grupo (todas as colunas), não só na célula A
    for (const col of COLS.slice(0, completa ? 12 : 4)) {
      const cc = ws.getCell(`${col}${r}`);
      cc.border = gradeAuto;
      cc.fill = fill(COR.sectionGray);
    }
    ws.getRow(r).height = 16.5;
    r++;
    for (const l of linhas) {
      linhasDeItem.push(r);
      if (completa) {
        const vals = [
          l.item, l.descricao, l.valorPolobh, l.valorCliente, l.statusAprovacao,
          l.fornecedorRazao, l.fornecedorCnpj, l.faturaNf, l.codigoServico,
          l.pedidoCompra, l.statusOs, l.contratoStatus,
        ];
        vals.forEach((v, i) => {
          const col = COLS[i];
          const c = ws.getCell(`${col}${r}`);
          c.value = v as ExcelJS.CellValue;
          // "Item" vem um ponto maior e em negrito no modelo; o resto, 11pt normal.
          c.font = { name: FONT_LIGHT, bold: i === 0, size: i === 0 ? PT_ITEM : PT, color: { argb: COR.ink } };
          c.border = gradeAuto;
          // Tudo centrado na vertical e com quebra de texto; o alinhamento
          // horizontal sai da tabela medida nos modelos de 2026.
          c.alignment = { wrapText: true, vertical: "middle", horizontal: ALINHAMENTO_ITEM[col] ?? "left" };
          if (MOEDA.has(i)) c.numFmt = FORMATO_MOEDA_ITEM;
          // Sem preenchimento nas linhas de dados — o destaque fica só no cabeçalho.
        });
        // Altura pela coluna mais "cheia" (Item ou Descrição), para nada ficar
        // cortado; a linha de uma só linha visual fica nos 15pt do modelo.
        ws.getRow(r).height = alturaItem(l.item, l.descricao);
      } else {
        // Modelo financeiro = o do arquivo original: Item em A (negrito) e a
        // descrição em B, sem mesclar — é assim que a Pólobh distribui as células.
        ws.getCell(`A${r}`).value = l.item;
        ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT_ITEM, color: { argb: COR.ink } };
        ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
        ws.getCell(`B${r}`).value = l.descricao;
        ws.getCell(`B${r}`).font = { name: FONT_LIGHT, size: PT, color: { argb: COR.ink } };
        ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
        for (const [col, valor] of [["C", l.valorPolobh], ["D", l.valorCliente]] as const) {
          const c = ws.getCell(`${col}${r}`);
          c.value = valor;
          c.font = { name: FONT_LIGHT, size: PT, color: { argb: COR.ink } };
          c.numFmt = FORMATO_MOEDA_ITEM;
          c.alignment = { horizontal: "distributed", vertical: "middle", wrapText: true };
        }
        for (const col of ["A", "B", "C", "D"]) ws.getCell(`${col}${r}`).border = gradeAuto;
        ws.getRow(r).height = alturaItem(l.item, l.descricao);
      }
      r++;
      // Descrição Completa e observações não têm coluna no modelo e são longas
      // demais para uma célula: saem em blocos mesclados logo abaixo do item.
      if (completa) {
        escreverBlocoTexto("Descrição Completa:", htmlParaLinhas(l.descricaoCompleta));
        const obs = (l.observacoes ?? [])
          .filter((o) => o.texto.trim())
          .map((o) => `• ${o.texto}${o.autorNome ? " — " + o.autorNome : ""}`);
        escreverBlocoTexto("Observações:", obs);
      }
    }
  }
  const itemEnd = r - 1; // fim do intervalo das linhas de custo

  /**
   * Realces por conteúdo na faixa de status/documentação (E:L), reproduzindo as
   * regras de formatação condicional dos modelos de 2026.
   *
   * A ordem importa: quem tem prioridade menor vence. "Nota Fiscal" vem antes de
   * "Fatura" para "Fatura e Nota Fiscal" sair verde (o documento final já
   * existe), e "Emitir" cobre também "Emitir Nova Versão", que o contém.
   */
  if (completa && linhasDeItem.length) {
    // Só as linhas de item entram na faixa. Incluir as barras de grupo e os
    // blocos de descrição faria uma descrição que cite "Pendente" acender de
    // vermelho — o realce vale para a célula de status, não para texto corrido.
    const faixas: string[] = [];
    for (let i = 0; i < linhasDeItem.length; i++) {
      const inicio = linhasDeItem[i];
      while (i + 1 < linhasDeItem.length && linhasDeItem[i + 1] === linhasDeItem[i] + 1) i++;
      faixas.push(`E${inicio}:${ultimaColuna}${linhasDeItem[i]}`);
    }
    ws.addConditionalFormatting({
      ref: faixas.join(" "),
      rules: [
        regraRealce("Nota Fiscal", REALCE.verde, 1),
        regraRealce("Não se Aplica", REALCE.verde, 2),
        regraRealce("Concluído", REALCE.verde, 3),
        regraRealce("Emitir", REALCE.ambar, 4),
        regraRealce("Fatura", REALCE.ambar, 5),
        regraRealce("Estimado", REALCE.ambar, 6),
        regraRealce("Pendente", REALCE.vermelho, 7),
        regraRealce("OK", REALCE.verde, 8),
      ],
    });
  }
  // Produção agora é um grupo normal de itens (não há mais o bloco fixo separado).

  // ---------- Totais ----------
  // Fórmulas VIVAS (recalculam se a planilha for editada no Excel), em duas
  // colunas como o modelo original: C = lado Pólobh · D = lado Cliente.
  r++;
  const moeda = FORMATO_MOEDA;
  const temItens = itemEnd >= itemStart;
  const fSomaC = temItens ? `SUM(C${itemStart}:C${itemEnd})` : "0";
  const fSomaD = temItens ? `SUM(D${itemStart}:D${itemEnd})` : undefined;

  type Val = { formula?: string; result: number };
  const totalRow = (
    label: string,
    desc: string,
    cVal: Val,
    dVal: Val | null,
    destaque = false
  ) => {
    // As três linhas de fechamento do modelo (Valor total bruto e os dois
    // Faturamentos) são exatamente as que não têm coluna Cliente: lá o valor
    // ocupa C até a última coluna, alinhado à direita e SEM o "R$". As demais
    // seguem em "distribuído" com o R$, igual às linhas de item logo acima.
    const fechamento = dVal === null;
    // Destaque (Valor Total Bruto) usa o dourado do modelo original — texto escuro (não branco).
    const corTxt = COR.ink;
    if (!completa) ws.mergeCells(`A${r}:B${r}`);
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: corTxt } };
    a.alignment = { vertical: "middle" };
    if (completa) {
      const b = ws.getCell(`B${r}`);
      b.value = desc;
      // No modelo a descrição do total é 11pt preto, justificada e alinhada ao
      // topo — não é uma legenda menor e cinza.
      b.font = { name: FONT_LIGHT, bold: destaque, size: PT, color: { argb: corTxt } };
      b.alignment = { wrapText: true, vertical: destaque ? "middle" : "top", horizontal: destaque ? "left" : "justify" };
    }
    const setVal = (ref: string, v: Val) => {
      const c = ws.getCell(ref);
      c.value = v.formula
        ? ({ formula: v.formula, result: v.result } as ExcelJS.CellValue)
        : v.result;
      c.numFmt = fechamento ? FORMATO_TOTAL_FINAL : moeda;
      c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: corTxt } };
      c.alignment = fechamento
        ? { horizontal: "right", vertical: "middle", wrapText: true }
        : { horizontal: "distributed", vertical: "middle", wrapText: true };
    };
    if (dVal === null) {
      ws.mergeCells(`C${r}:${ultimaColuna}${r}`);
      setVal(`C${r}`, cVal);
    } else {
      setVal(`C${r}`, cVal);
      setVal(`D${r}`, dVal);
    }
    // Só o Valor Total Bruto recebe destaque (dourado); as demais linhas ficam sem preenchimento,
    // como na EC original da Pólobh.
    for (const col of COLS.slice(0, completa ? 12 : 4)) {
      const c = ws.getCell(`${col}${r}`);
      c.border = gradeAuto;
      if (destaque) c.fill = fill(COR.gold);
    }
    r++;
  };

  const rSoma = r;
  totalRow(
    "Soma dos fornecedores", "Serviços de terceiros + produção",
    { formula: fSomaC, result: t.somaFornecedores },
    { formula: fSomaD, result: t.somaCliente }
  );
  const hon = ec.honorarios;
  const enc = ec.encargos;
  const rHon = r;
  // O rótulo carrega o percentual E a taxa mínima, sinalizando qual dos dois valeu.
  // Com o mínimo em vigor o valor não é mais C*percentual, então não vai fórmula viva.
  const usaFormulaHon = hon.modo === "percentual" && !t.honorariosMinimoAplicado;
  totalRow(
    "Pólobh",
    `${ec.honorariosRotulo?.trim() || "Honorários Serviços de Organização e Planejamento"} (${rotuloTaxa(hon, t.honorariosMinimoAplicado)})`,
    usaFormulaHon ? { formula: `C${rSoma}*${hon.valor}`, result: t.honorariosPolobh } : { result: t.honorariosPolobh },
    usaFormulaHon ? { formula: `D${rSoma}*${hon.valor}`, result: t.honorariosCliente } : { result: t.honorariosCliente }
  );
  const rEnc = r;
  totalRow(
    "Encargos",
    `${ec.encargosRotulo?.trim() || "Incidentes sobre serviços terceiros contratados através da Pólobh"} (${rotuloTaxa(enc)})`,
    enc.modo === "fixo" ? { result: t.encargos } : { formula: `C${rSoma}*${enc.valor}`, result: t.encargos },
    { result: 0 }
  );
  const rSub = r;
  totalRow(
    "Sub-total", "Reembolso Serviços terceiros + Honorários Pólobh + Encargos",
    { formula: `C${rSoma}+C${rHon}+C${rEnc}`, result: t.subTotalPolobh },
    { formula: `D${rSoma}+D${rHon}`, result: Math.round((t.somaCliente + t.honorariosCliente) * 100) / 100 }
  );
  // No modelo a faixa E:M do bloco de totais é uma célula só — sem ela, o Excel
  // desenharia uma grade de células vazias ao lado dos valores.
  if (completa) ws.mergeCells(`E${rSoma}:${ultimaColuna}${rSub}`);

  totalRow(
    "Valor total bruto", "Custo total do projeto",
    { formula: `C${rSub}+D${rSub}`, result: t.valorTotalBruto },
    null, true
  );

  // "Sendo:" é uma faixa própria no modelo — mesclada de ponta a ponta, 11pt
  // em negrito e centrada, não uma legenda italicizada.
  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value = "Sendo:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
  ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (const col of COLS.slice(0, completa ? 12 : 4)) ws.getCell(`${col}${r}`).border = gradeAuto;
  r++;

  totalRow(
    "Faturamento Pólobh", "Valor Total Geral NF Pólobh x Cliente",
    { formula: `C${rSub}+D${rHon}`, result: t.faturamentoPolobh },
    null
  );
  totalRow(
    "Faturamento Terceiros", "Valor Total Geral NF's Terceiros x Cliente",
    { formula: `D${rSoma}`, result: t.faturamentoTerceiros },
    null
  );

  // ---------- Bloco contratual (aprovação/assinaturas — conforme o modelo) ----------
  r++;
  ws.getCell(`A${r}`).value = "Visto Pólobh:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT };
  ws.mergeCells(`B${r}:C${r}`);
  ws.getCell(`B${r}`).value = ec.responsavel;
  ws.getCell(`B${r}`).font = { name: FONT_LIGHT, size: PT };
  ws.getCell(`D${r}`).value = dataBR(new Date().toISOString());
  ws.getCell(`D${r}`).font = { name: FONT_LIGHT, size: PT };
  r++;

  ws.getCell(`A${r}`).value = "Validade";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT };
  ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
  ws.getCell(`B${r}`).value = `Esta Estimativa de Custos | Orçamento é válida por ${ec.validadeDias} dias.`;
  ws.getCell(`B${r}`).font = { name: FONT_LIGHT, size: PT };
  r += 2;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value = "INFORMAÇÕES GERAIS:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT };
  r++;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  const legal = ws.getCell(`A${r}`);
  legal.value =
    "A aprovação desta proposta, seja por meio de assinatura ou por e-mail, tem força contratual, " +
    "gera obrigações entre as partes (compatíveis com os descritivos dos serviços e/ou produtos nela relacionados) " +
    "e pressupõe que o cliente concorda e aceita os termos nela descritos, com os valores devidos à Pólobh " +
    "(reembolsos, honorários pelos serviços de organização e planejamento e taxa de administração sobre serviços " +
    "de terceiros) e às empresas contratadas por conta e ordem do cliente para fornecimento de serviços e " +
    "mercadorias vinculados ao projeto, e promete efetuar o pagamento do valor descrito na linha " +
    '"Total Geral NF Pólobh x Cliente" no prazo máximo de 30 dias a partir da apresentação da(s) nota(s) ' +
    "fiscal(is) da Pólobh, que poderão ser emitidas pela Pólobh Promoções Eireli e MF Promoções Eireli, " +
    "ambas do mesmo grupo empresarial, em conjunto ou separadamente.";
  legal.font = { name: FONT_LIGHT, size: PT - 2.5, color: { argb: COR.ink } };
  legal.alignment = { wrapText: true, vertical: "top", horizontal: "justify" };
  ws.getRow(r).height = 66;
  r++;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value =
    "Obs.: Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto | peça que porventura existam.";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, italic: true, size: PT - 1.5 };
  r += 2;

  ws.getCell(`A${r}`).value = "Aprovação do Cliente:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT };
  ws.mergeCells(`B${r}:C${r}`);
  ws.getCell(`B${r}`).border = { bottom: { style: "thin", color: { argb: COR.ink } } };
  ws.getCell(`D${r}`).value = "____ ____ ______";
  ws.getCell(`D${r}`).font = { name: FONT_LIGHT, size: PT };
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value = "Identificação do Signatário: Nome e Identidade Funcional";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, size: PT - 1.5, color: { argb: COR.ink2 } };
  r++;

  ws.getCell(`A${r}`).value = "Protocolo Financeiro Pólobh:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT };
  ws.getCell(`B${r}`).value = "Assinatura:";
  ws.getCell(`B${r}`).font = { name: FONT_LIGHT, size: PT };
  ws.getCell(`C${r}`).border = { bottom: { style: "thin", color: { argb: COR.ink } } };
  ws.getCell(`D${r}`).value = "____ ____ ______";
  ws.getCell(`D${r}`).font = { name: FONT_LIGHT, size: PT };
  ws.getRow(r).height = 22;

  // Impressão: área definida + cabeçalho da tabela repetido em toda página
  ws.pageSetup.printArea = `A1:${ultimaColuna}${r}`;
  ws.pageSetup.printTitlesRow = `${hr}:${hr}`;

  const buffer = await wb.xlsx.writeBuffer();
  // Nome do arquivo no padrão pedido: "{Título do Projeto} {NN} Em {DD/MM/AA}"
  // (NN = versão com 2 dígitos, sem "V" nem pontos). Usa o título COMPLETO do
  // projeto (não o número da EC, que é abreviado e "comia" parte do título).
  const nome = nomeEcExcel(ec, completa ? "completa" : "financeiro");
  return { buffer: buffer as ArrayBuffer, nome };
}

export async function gerarEcExcel(
  ec: Ec,
  opts?: { picker?: boolean; modelo?: ModeloEcExcel }
): Promise<"salvo" | "cancelado" | "baixado"> {
  const { buffer, nome } = await criarEcExcelBuffer(ec, opts?.modelo);
  if (opts?.picker) return salvarComPicker(buffer as ArrayBuffer, nome);
  baixar(buffer, nome);
  return "baixado";
}
