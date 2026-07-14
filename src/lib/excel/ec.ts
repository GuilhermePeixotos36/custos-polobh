/**
 * Geração da EC em Excel. Recriamos o layout da planilha real em /reference
 * com ExcelJS (que aplica estilos — diferente do SheetJS), usando a paleta
 * Pólobh. A tabela de custos é dinâmica, por isso montamos sob medida.
 */
import ExcelJS from "exceljs";
import type { Ec } from "@/data/types";
import { calcularTotais, totalProducao } from "@/domain/calc";
import { dataBR } from "@/lib/format";
import { COR, fill, thin, baixar, salvarComPicker, nomeArquivo, carregarLogo } from "./shared";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/** Altura máxima de linha no Excel (em pontos). */
const ALTURA_MAX = 409;

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

  // larguras (Item, Descrição largo, valores, etc.)
  const widths = completa
    ? [16, 34, 13, 13, 14, 20, 18, 12, 13, 14, 10, 22]
    : [22, 22, 16, 16];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const t = calcularTotais(ec.linhas, ec.producao);
  let r = 1;

  // ---------- Cabeçalho / logo ----------
  ws.mergeCells(`A${r}:B${r + 1}`);
  ws.mergeCells(`C${r}:${ultimaColuna}${r + 1}`);
  const titulo = ws.getCell(`C${r}`);
  titulo.value = "Estimativa de Custos | Proposta Comercial";
  titulo.font = { name: "Calibri", size: 16, bold: true, color: { argb: COR.white } };
  titulo.alignment = { vertical: "middle", horizontal: "center" };
  for (const c of COLS.slice(2, completa ? 12 : 4)) ws.getCell(`${c}${r}`).fill = fill(COR.black);
  ws.getCell(`A${r}`).fill = fill(COR.black);
  ws.getCell(`B${r}`).fill = fill(COR.black);
  ws.getRow(r).height = 26;
  ws.getRow(r + 1).height = 26;

  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo as any, extension: "png" });
    ws.addImage(id, { tl: { col: 0.2, row: r - 0.8 }, ext: { width: 92, height: 56 } });
  }
  r += 2;

  // ---------- Meta ----------
  const meta = (label: string, valor: string) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: true, size: 10 };
    ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
    ws.getCell(`B${r}`).value = valor;
    ws.getCell(`B${r}`).font = { size: 10 };
    r++;
  };
  meta("Data:", dataBR(new Date().toISOString())); // data de geração (modelo usa =HOJE())
  meta("Número EC | Orçamento:", ec.numero);

  // ---------- Seção util ----------
  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 11, color: { argb: COR.white } };
    c.fill = fill(COR.primary);
    c.alignment = { vertical: "middle" };
    ws.getRow(r).height = 20;
    r++;
  };
  const linhaLV = (label: string, valor: string) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: true, size: 10 };
    ws.getCell(`A${r}`).fill = fill(COR.soft);
    ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
    ws.getCell(`B${r}`).value = valor;
    ws.getCell(`B${r}`).font = { size: 10 };
    ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "top" };
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
  secao("ESTIMATIVA DE CUSTOS");
  const hr = r;
  const headers: [string, string][] = completa
    ? [
        ["A", "Item"], ["B", "Descrição Financeiro"], ["C", "Pólobh"], ["D", "Cliente"],
        ["E", "Status Aprovação"], ["F", "Fornecedor (Razão Social)"], ["G", "Fornecedor (CNPJ)"],
        ["H", "Fatura ou Nota Fiscal"], ["I", "Código Serviço"], ["J", "Pedido de Compra"],
        ["K", "OS"], ["L", "Contrato"],
      ]
    : [["A", "Item"], ["C", "Pólobh"], ["D", "Cliente"]];
  if (!completa) ws.mergeCells(`A${hr}:B${hr}`);
  headers.forEach(([col, h]) => {
    const c = ws.getCell(`${col}${hr}`);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: COR.white } };
    c.fill = fill(COR.black);
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    c.border = thin;
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
    // Estima linhas visuais por texto (largura mesclada A:L ≈ 199 caracteres).
    const visuais = (s: string) => Math.max(1, Math.ceil(s.length / 190));
    const LINHAS_ALVO = Math.floor((ALTURA_MAX - 8) / 13); // ~30 linhas visuais por célula
    let buffer: string[] = [];
    let acc = 0;
    const flush = () => {
      if (!buffer.length) return;
      ws.mergeCells(`A${r}:L${r}`);
      const c = ws.getCell(`A${r}`);
      c.value = buffer.join("\n");
      c.font = { size: 9, color: { argb: COR.ink2 } };
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
    cab.font = { size: 8.5, bold: true, italic: true, color: { argb: COR.ink2 } };
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
    gc.font = { bold: true, size: 10, color: { argb: COR.ink } };
    gc.fill = fill(COR.soft);
    gc.border = thin;
    r++;
    for (const l of linhas) {
      if (completa) {
        const contratoTxt = `${l.contratoStatus || "Pendente"}${l.contrato ? " · " + l.contrato : ""}`;
        const vals = [
          l.item, l.descricao, l.valorPolobh, l.valorCliente, l.statusAprovacao,
          l.fornecedorRazao, l.fornecedorCnpj, l.faturaNf, l.codigoServico,
          l.pedidoCompra, l.statusOs, contratoTxt,
        ];
        vals.forEach((v, i) => {
          const c = ws.getCell(`${COLS[i]}${r}`);
          c.value = v as ExcelJS.CellValue;
          c.font = { size: 9 };
          c.border = thin;
          c.alignment = { wrapText: true, vertical: "top" };
          if (i === 2 || i === 3) {
            c.numFmt = '"R$" #,##0.00';
            c.alignment = { horizontal: "right" };
          }
        });
      } else {
        ws.mergeCells(`A${r}:B${r}`);
        ws.getCell(`A${r}`).value = l.item;
        ws.getCell(`A${r}`).font = { size: 9 };
        ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
        for (const [col, valor] of [["C", l.valorPolobh], ["D", l.valorCliente]] as const) {
          const c = ws.getCell(`${col}${r}`);
          c.value = valor;
          c.font = { size: 9 };
          c.numFmt = '"R$" #,##0.00';
          c.alignment = { horizontal: "right" };
        }
        for (const col of ["A", "B", "C", "D"]) ws.getCell(`${col}${r}`).border = thin;
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

  // ---------- Produção ----------
  secao("PRODUÇÃO");
  const prodStart = r;
  const prod = ec.producao;
  const prodLinhas: [string, string, number][] = [
    ["Despesas operacionais", "Motoboy, cartório, Correios.", prod.despesasOperacionais * prod.qtdDespesas],
    ["Equipe", `Diária BH R$ ${prod.equipeBH} · Viagem R$ ${prod.equipeViagem}`, prod.equipeBH * prod.qtdEquipeBH + prod.equipeViagem * prod.qtdEquipeViagem],
    ["Transporte", `BH R$ ${prod.transporteBH}/dia · Viagem R$ ${prod.transporteViagem}/dia`, prod.transporteBH * prod.qtdTransporteBH + prod.transporteViagem * prod.qtdTransporteViagem],
    ["Alimentação", `BH R$ ${prod.alimentacaoBH}/dia · Viagem R$ ${prod.alimentacaoViagem}`, prod.alimentacaoBH * prod.qtdAlimentacaoBH + prod.alimentacaoViagem * prod.qtdAlimentacaoViagem],
  ];
  for (const [nome, desc, val] of prodLinhas) {
    if (completa) {
      ws.getCell(`A${r}`).value = nome;
      ws.getCell(`A${r}`).font = { bold: true, size: 9 };
      ws.getCell(`B${r}`).value = desc;
      ws.getCell(`B${r}`).font = { size: 9 };
    } else {
      ws.mergeCells(`A${r}:B${r}`);
      ws.getCell(`A${r}`).value = nome;
      ws.getCell(`A${r}`).font = { bold: true, size: 9 };
    }
    const c = ws.getCell(`C${r}`);
    c.value = val;
    c.numFmt = '"R$" #,##0.00';
    c.font = { size: 9 };
    [`A${r}`, `B${r}`, `C${r}`, `D${r}`].forEach((a) => (ws.getCell(a).border = thin));
    r++;
  }
  const prodEnd = r - 1; // fim do intervalo de produção (p/ fórmulas)
  void totalProducao;

  // ---------- Totais ----------
  // Fórmulas VIVAS (recalculam se a planilha for editada no Excel), em duas
  // colunas como o modelo original: C = lado Pólobh · D = lado Cliente.
  r++;
  const moeda = '"R$" #,##0.00';
  const temItens = itemEnd >= itemStart;
  const fSomaC = temItens
    ? `SUM(C${itemStart}:C${itemEnd})+SUM(C${prodStart}:C${prodEnd})`
    : `SUM(C${prodStart}:C${prodEnd})`;
  const fSomaD = temItens ? `SUM(D${itemStart}:D${itemEnd})` : undefined;

  type Val = { formula?: string; result: number };
  const totalRow = (
    label: string,
    desc: string,
    cVal: Val,
    dVal: Val | null,
    destaque = false
  ) => {
    const corTxt = destaque ? COR.white : COR.ink;
    if (!completa) ws.mergeCells(`A${r}:B${r}`);
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { bold: true, size: 10, color: { argb: corTxt } };
    a.alignment = { vertical: "middle" };
    if (completa) {
      const b = ws.getCell(`B${r}`);
      b.value = desc;
      b.font = { size: 9, color: { argb: destaque ? COR.white : COR.ink2 } };
      b.alignment = { wrapText: true, vertical: "middle" };
    }
    const setVal = (ref: string, v: Val) => {
      const c = ws.getCell(ref);
      c.value = v.formula
        ? ({ formula: v.formula, result: v.result } as ExcelJS.CellValue)
        : v.result;
      c.numFmt = moeda;
      c.font = { bold: true, size: 10, color: { argb: corTxt } };
      c.alignment = { horizontal: "right", vertical: "middle" };
    };
    if (dVal === null) {
      ws.mergeCells(`C${r}:D${r}`);
      setVal(`C${r}`, cVal);
    } else {
      setVal(`C${r}`, cVal);
      setVal(`D${r}`, dVal);
    }
    for (const col of ["A", "B", "C", "D"]) {
      const c = ws.getCell(`${col}${r}`);
      c.border = thin;
      if (destaque) c.fill = fill(COR.primary);
      else if (col === "A") c.fill = fill(COR.soft);
    }
    r++;
  };

  const rSoma = r;
  totalRow(
    "Soma dos fornecedores", "Serviços de terceiros + produção",
    { formula: fSomaC, result: t.somaFornecedores },
    { formula: fSomaD, result: t.somaCliente }
  );
  const rHon = r;
  totalRow(
    "Pólobh", "Honorários Serviços de Organização e Planejamento (15%)",
    { formula: `C${rSoma}*0.15`, result: t.honorariosPolobh },
    { formula: `D${rSoma}*0.15`, result: t.honorariosCliente }
  );
  const rEnc = r;
  totalRow(
    "Encargos", "Incidentes sobre serviços terceiros contratados através da Pólobh (16,33%)",
    { formula: `C${rSoma}*0.1633`, result: t.encargos },
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
  ws.getCell(`A${r}`).font = { bold: true, size: 9, italic: true, color: { argb: COR.ink2 } };
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
  ws.getCell(`A${r}`).font = { bold: true, size: 10 };
  ws.mergeCells(`B${r}:C${r}`);
  ws.getCell(`B${r}`).value = ec.responsavel;
  ws.getCell(`B${r}`).font = { size: 10 };
  ws.getCell(`D${r}`).value = dataBR(new Date().toISOString());
  ws.getCell(`D${r}`).font = { size: 10 };
  r++;

  ws.getCell(`A${r}`).value = "Validade";
  ws.getCell(`A${r}`).font = { bold: true, size: 10 };
  ws.mergeCells(`B${r}:${ultimaColuna}${r}`);
  ws.getCell(`B${r}`).value = `Esta Estimativa de Custos | Orçamento é válida por ${ec.validadeDias} dias.`;
  ws.getCell(`B${r}`).font = { size: 10 };
  r += 2;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value = "INFORMAÇÕES GERAIS:";
  ws.getCell(`A${r}`).font = { bold: true, size: 10 };
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
  legal.font = { size: 8.5, color: { argb: COR.ink } };
  legal.alignment = { wrapText: true, vertical: "top", horizontal: "justify" };
  ws.getRow(r).height = 66;
  r++;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value =
    "Obs.: Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto | peça que porventura existam.";
  ws.getCell(`A${r}`).font = { italic: true, size: 9 };
  r += 2;

  ws.getCell(`A${r}`).value = "Aprovação do Cliente:";
  ws.getCell(`A${r}`).font = { bold: true, size: 10 };
  ws.mergeCells(`B${r}:C${r}`);
  ws.getCell(`B${r}`).border = { bottom: { style: "thin", color: { argb: COR.ink } } };
  ws.getCell(`D${r}`).value = "____/____/______";
  ws.getCell(`D${r}`).font = { size: 10 };
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(`A${r}:${ultimaColuna}${r}`);
  ws.getCell(`A${r}`).value = "Identificação do Signatário: Nome e Identidade Funcional";
  ws.getCell(`A${r}`).font = { size: 9, color: { argb: COR.ink2 } };
  r++;

  ws.getCell(`A${r}`).value = "Protocolo Financeiro Pólobh:";
  ws.getCell(`A${r}`).font = { bold: true, size: 10 };
  ws.getCell(`B${r}`).value = "Assinatura:";
  ws.getCell(`B${r}`).font = { size: 10 };
  ws.getCell(`C${r}`).border = { bottom: { style: "thin", color: { argb: COR.ink } } };
  ws.getCell(`D${r}`).value = "____/____/______";
  ws.getCell(`D${r}`).font = { size: 10 };
  ws.getRow(r).height = 22;

  // Impressão: área definida + cabeçalho da tabela repetido em toda página
  ws.pageSetup.printArea = `A1:${ultimaColuna}${r}`;
  ws.pageSetup.printTitlesRow = `${hr}:${hr}`;

  const buffer = await wb.xlsx.writeBuffer();
  // Nome do arquivo = código da EC + data de criação (ex.: "EC – ... – V02 - 13-07-2026.xlsx").
  const sufixoModelo = completa ? "Completa" : "Financeiro";
  const nome = `${nomeArquivo(`${ec.numero} - ${sufixoModelo} - ${dataBR(ec.criadoEm)}`)}.xlsx`;
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
