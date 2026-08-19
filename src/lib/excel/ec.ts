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
  COR, fill, thin, grade, baixar, salvarComPicker, carregarLogo, encaixarLogo,
  linhasVisuais, alturaParaLinhas, ALTURA_MAX_LINHA, FONT_BOLD, FONT_LIGHT,
} from "./shared";
import { nomeEcExcel } from "./nomeEc";

/** Colunas de fornecedor/documentação com destaque azul-claro no modelo original da Pólobh. */
const COLS_DESTAQUE = new Set(["E", "F", "G", "H", "I", "J"]);

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const ALTURA_MAX = ALTURA_MAX_LINHA;

/** Formato de moeda exato do modelo original (barra invertida = espaço fixo após R$). */
const FORMATO_MOEDA = '"R$"\ #,##0.00';

/** Índices das colunas de dinheiro na linha de item (C e D). */
const MOEDA = new Set([2, 3]);

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

  // Larguras medidas na EC original da Pólobh (reference/*.xlt): A=25, B=63,4,
  // C=13,6 e as demais 16,6. O modelo "financeiro" é exatamente o do arquivo
  // original (4 colunas); o "completa" acrescenta as colunas de documentação.
  const widths = completa
    ? [25, 63.4, 13.6, 16.6, 16.6, 16.6, 16.6, 16.6, 16.6, 16.6, 16.6, 16.6]
    : [25, 63.4, 13.6, 16.6];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Corpo em 11pt (tamanho do modelo). Na versão completa, 12 colunas em 11pt
  // não cabem na página: só ali o corpo encolhe, mantendo cores, bordas,
  // negritos e alinhamentos idênticos.
  const PT = completa ? 9.5 : 11;

  const t = calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos);
  /** Largura somada de um intervalo de colunas — base para estimar a altura das linhas. */
  const larguraDe = (colInicio: string, colFim: string) => {
    const i = COLS.indexOf(colInicio);
    const f = COLS.indexOf(colFim);
    return widths.slice(i, f + 1).reduce((s, w) => s + w, 0);
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
    const ext = encaixarLogo(logo, { largura: 168, altura: 118 });
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
      cc.border = grade;
      cc.fill = fill(variante === "gold" ? COR.gold : COR.sectionGray);
    }
    ws.getRow(r).height = variante === "gold" ? 20 : 24;
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
  const headers: [string, string][] = completa
    ? [
        ["A", "Item"], ["B", "Descrição Financeiro"], ["C", "Pólobh"], ["D", "Cliente"],
        ["E", "Status Aprovação"], ["F", "Fornecedor (Razão Social)"], ["G", "Fornecedor (CNPJ)"],
        ["H", "Documento PG"], ["I", "Código Serviço"], ["J", "Pedido de Compra"],
        ["K", "OS"], ["L", "Contrato"],
      ]
    // Modelo financeiro = as 4 colunas do arquivo original, com "Descrição" em B
    // (não mesclada com A — a descrição tem coluna própria lá).
    : [["A", "Item"], ["B", "Descrição"], ["C", "Pólobh"], ["D", "Cliente"]];
  // Colunas de texto alinham à esquerda; as de dinheiro, à direita, para o
  // cabeçalho ficar sobre os próprios números.
  const COLS_VALOR = new Set(["C", "D"]);
  headers.forEach(([col, h]) => {
    const c = ws.getCell(`${col}${hr}`);
    c.value = h;
    c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    // Fundo azul-claro só nas colunas de fornecedor/documentação (padrão da EC original).
    if (completa && COLS_DESTAQUE.has(col)) c.fill = fill(COR.statusBlue);
    c.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: COLS_VALOR.has(col) ? "right" : completa ? "center" : "left",
    };
    c.border = grade;
  });
  ws.getRow(hr).height = 30;
  r++;
  const itemStart = r; // início do intervalo das linhas de custo (p/ fórmulas)

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
    const larguraBloco = larguraDe("A", "L");
    const visuais = (s: string) => linhasVisuais(s, larguraBloco);
    const LINHAS_ALVO = Math.floor((ALTURA_MAX - 8) / 13); // ~30 linhas visuais por célula
    let buffer: string[] = [];
    let acc = 0;
    const flush = () => {
      if (!buffer.length) return;
      ws.mergeCells(`A${r}:L${r}`);
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
    ws.mergeCells(`A${r}:L${r}`);
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
      cc.border = grade;
      cc.fill = fill(COR.sectionGray);
    }
    ws.getRow(r).height = 16.5;
    r++;
    for (const l of linhas) {
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
          // Coluna Item em negrito; descrição e demais campos em peso normal.
          c.font = { name: FONT_LIGHT, bold: i === 0, size: PT, color: { argb: COR.ink } };
          c.border = grade;
          // Tudo centrado na vertical e com quebra de texto, como no modelo.
          c.alignment = MOEDA.has(i)
            ? { horizontal: "right", vertical: "middle" }
            : { wrapText: true, vertical: "middle", horizontal: "left" };
          if (MOEDA.has(i)) c.numFmt = FORMATO_MOEDA;
          // Fundo azul-claro nas colunas de fornecedor/documentação (padrão da EC original).
          if (COLS_DESTAQUE.has(col)) c.fill = fill(COR.statusBlue);
        });
        // Altura pela coluna mais "cheia" (Item ou Descrição), para nada ficar cortado.
        ws.getRow(r).height = alturaParaLinhas(
          Math.max(linhasVisuais(l.item, larguraDe("A", "A")), linhasVisuais(l.descricao, larguraDe("B", "B"))),
          PT + 3
        );
      } else {
        // Modelo financeiro = o do arquivo original: Item em A (negrito) e a
        // descrição em B, sem mesclar — é assim que a Pólobh distribui as células.
        ws.getCell(`A${r}`).value = l.item;
        ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
        ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
        ws.getCell(`B${r}`).value = l.descricao;
        ws.getCell(`B${r}`).font = { name: FONT_LIGHT, size: PT, color: { argb: COR.ink } };
        ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
        for (const [col, valor] of [["C", l.valorPolobh], ["D", l.valorCliente]] as const) {
          const c = ws.getCell(`${col}${r}`);
          c.value = valor;
          c.font = { name: FONT_LIGHT, size: PT, color: { argb: COR.ink } };
          c.numFmt = FORMATO_MOEDA;
          c.alignment = { horizontal: "right", vertical: "middle" };
        }
        for (const col of ["A", "B", "C", "D"]) ws.getCell(`${col}${r}`).border = grade;
        ws.getRow(r).height = alturaParaLinhas(
          Math.max(linhasVisuais(l.item, larguraDe("A", "A")), linhasVisuais(l.descricao, larguraDe("B", "B"))),
          PT + 3
        );
      }
      r++;
      if (completa) {
        escreverBlocoTexto("Descrição Completa:", htmlParaLinhas(l.descricaoCompleta));
        const obs = (l.observacoes ?? []).filter((o) => o.texto.trim()).map((o) => `• ${o.texto}${o.autorNome ? " — " + o.autorNome : ""}`);
        escreverBlocoTexto("Observações:", obs);
      }
    }
  }
  const itemEnd = r - 1; // fim do intervalo das linhas de custo
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
      b.font = { name: FONT_LIGHT, size: PT - 1.5, color: { argb: COR.ink2 } };
      b.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    }
    const setVal = (ref: string, v: Val) => {
      const c = ws.getCell(ref);
      c.value = v.formula
        ? ({ formula: v.formula, result: v.result } as ExcelJS.CellValue)
        : v.result;
      c.numFmt = moeda;
      c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: corTxt } };
      c.alignment = { horizontal: "right", vertical: "middle" };
    };
    if (dVal === null) {
      ws.mergeCells(`C${r}:D${r}`);
      setVal(`C${r}`, cVal);
    } else {
      setVal(`C${r}`, cVal);
      setVal(`D${r}`, dVal);
    }
    // Só o Valor Total Bruto recebe destaque (dourado); as demais linhas ficam sem preenchimento,
    // como na EC original da Pólobh.
    for (const col of ["A", "B", "C", "D"]) {
      const c = ws.getCell(`${col}${r}`);
      c.border = grade;
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
  totalRow(
    "Valor total bruto", "Custo total do projeto",
    { formula: `C${rSub}+D${rSub}`, result: t.valorTotalBruto },
    null, true
  );

  ws.getCell(`A${r}`).value = "Sendo:";
  ws.getCell(`A${r}`).font = { name: FONT_LIGHT, bold: true, size: PT - 1.5, italic: true, color: { argb: COR.ink2 } };
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
