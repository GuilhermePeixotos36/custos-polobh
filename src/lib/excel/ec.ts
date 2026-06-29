/**
 * Geração da EC em Excel. Recriamos o layout da planilha real em /reference
 * com ExcelJS (que aplica estilos — diferente do SheetJS), usando a paleta
 * Pólobh. A tabela de custos é dinâmica, por isso montamos sob medida.
 */
import ExcelJS from "exceljs";
import type { Ec } from "@/data/types";
import { calcularTotais, totalProducao } from "@/domain/calc";
import { dataBR } from "@/lib/format";
import { COR, fill, thin, baixar, nomeArquivo, carregarLogo } from "./shared";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export async function gerarEcExcel(ec: Ec): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("EC", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  });

  // larguras (Item, Descrição largo, valores, etc.)
  const widths = [16, 34, 13, 13, 14, 20, 18, 12, 13, 14, 10, 22];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const t = calcularTotais(ec.linhas, ec.producao);
  let r = 1;

  // ---------- Cabeçalho / logo ----------
  ws.mergeCells(`A${r}:B${r + 1}`);
  ws.mergeCells(`C${r}:L${r + 1}`);
  const titulo = ws.getCell(`C${r}`);
  titulo.value = "Estimativa de Custos | Proposta Comercial";
  titulo.font = { name: "Calibri", size: 16, bold: true, color: { argb: COR.white } };
  titulo.alignment = { vertical: "middle", horizontal: "center" };
  for (const c of COLS.slice(2)) ws.getCell(`${c}${r}`).fill = fill(COR.black);
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
    ws.mergeCells(`B${r}:L${r}`);
    ws.getCell(`B${r}`).value = valor;
    ws.getCell(`B${r}`).font = { size: 10 };
    r++;
  };
  meta("Data:", dataBR(ec.atualizadoEm));
  meta("Número EC | Orçamento:", ec.numero);

  // ---------- Seção util ----------
  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:L${r}`);
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
    ws.mergeCells(`B${r}:L${r}`);
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
  const headers = [
    "Item", "Descrição", "Pólobh", "Cliente", "Status Aprovação",
    "Fornecedor (Razão Social)", "Fornecedor (CNPJ)", "Fatura ou Nota Fiscal",
    "Código Serviço", "Pedido de Compra", "OS", "Observação",
  ];
  const hr = r;
  headers.forEach((h, i) => {
    const c = ws.getCell(`${COLS[i]}${hr}`);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: COR.white } };
    c.fill = fill(COR.black);
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    c.border = thin;
  });
  ws.getRow(hr).height = 30;
  r++;

  // agrupar por GRUPO
  const grupos = new Map<string, typeof ec.linhas>();
  for (const l of [...ec.linhas].sort((a, b) => a.ordem - b.ordem)) {
    const g = l.grupo || "GERAL";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(l);
  }

  for (const [grupo, linhas] of grupos) {
    ws.mergeCells(`A${r}:L${r}`);
    const gc = ws.getCell(`A${r}`);
    gc.value = grupo;
    gc.font = { bold: true, size: 10, color: { argb: COR.ink } };
    gc.fill = fill(COR.soft);
    gc.border = thin;
    r++;
    for (const l of linhas) {
      const vals = [
        l.item, l.descricao, l.valorPolobh, l.valorCliente, l.statusAprovacao,
        l.fornecedorRazao, l.fornecedorCnpj, l.faturaNf, l.codigoServico,
        l.pedidoCompra, l.statusOs, l.observacao,
      ];
      vals.forEach((v, i) => {
        const c = ws.getCell(`${COLS[i]}${r}`);
        c.value = v as any;
        c.font = { size: 9 };
        c.border = thin;
        c.alignment = { wrapText: true, vertical: "top" };
        if (i === 2 || i === 3) {
          c.numFmt = '"R$" #,##0.00';
          c.alignment = { horizontal: "right" };
        }
      });
      r++;
    }
  }

  // ---------- Produção ----------
  secao("PRODUÇÃO");
  const prod = ec.producao;
  const prodLinhas: [string, string, number][] = [
    ["Despesas operacionais", "Motoboy, cartório, Correios.", prod.despesasOperacionais * prod.qtdDespesas],
    ["Equipe", `Diária BH R$ ${prod.equipeBH} · Viagem R$ ${prod.equipeViagem}`, prod.equipeBH * prod.qtdEquipeBH + prod.equipeViagem * prod.qtdEquipeViagem],
    ["Transporte", `BH R$ ${prod.transporteBH}/dia · Viagem R$ ${prod.transporteViagem}/dia`, prod.transporteBH * prod.qtdTransporteBH + prod.transporteViagem * prod.qtdTransporteViagem],
    ["Alimentação", `BH R$ ${prod.alimentacaoBH}/dia · Viagem R$ ${prod.alimentacaoViagem}`, prod.alimentacaoBH * prod.qtdAlimentacaoBH + prod.alimentacaoViagem * prod.qtdAlimentacaoViagem],
  ];
  for (const [nome, desc, val] of prodLinhas) {
    ws.getCell(`A${r}`).value = nome;
    ws.getCell(`A${r}`).font = { bold: true, size: 9 };
    ws.mergeCells(`B${r}:B${r}`);
    ws.getCell(`B${r}`).value = desc;
    ws.getCell(`B${r}`).font = { size: 9 };
    const c = ws.getCell(`C${r}`);
    c.value = val;
    c.numFmt = '"R$" #,##0.00';
    c.font = { size: 9 };
    [`A${r}`, `B${r}`, `C${r}`, `D${r}`].forEach((a) => (ws.getCell(a).border = thin));
    r++;
  }
  void totalProducao;

  // ---------- Totais ----------
  r++;
  const totalRow = (label: string, desc: string, valor: number, destaque = false) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: destaque ? COR.white : COR.ink } };
    ws.mergeCells(`B${r}:J${r}`);
    ws.getCell(`B${r}`).value = desc;
    ws.getCell(`B${r}`).font = { size: 9, color: { argb: destaque ? COR.white : COR.ink2 } };
    ws.mergeCells(`K${r}:L${r}`);
    const c = ws.getCell(`K${r}`);
    c.value = valor;
    c.numFmt = '"R$" #,##0.00';
    c.font = { bold: true, size: 10, color: { argb: destaque ? COR.white : COR.ink } };
    c.alignment = { horizontal: "right" };
    if (destaque) {
      [...COLS].forEach((col) => (ws.getCell(`${col}${r}`).fill = fill(COR.primary)));
    }
    r++;
  };
  totalRow("Soma dos fornecedores", "Σ valor Pólobh + produção", t.somaFornecedores);
  totalRow("Honorários Pólobh (15%)", "Serviços de organização e planejamento", t.honorariosPolobh);
  totalRow("Encargos (16,33%)", "Incidentes sobre serviços de terceiros", t.encargos);
  totalRow("Sub-total Pólobh", "Reembolso + Honorários + Encargos", t.subTotalPolobh);
  totalRow("Faturamento Terceiros", "Σ valor Cliente", t.faturamentoTerceiros);
  totalRow("Honorários Cliente (15%)", "Sobre valores faturados ao cliente", t.honorariosCliente);
  totalRow("Valor total bruto", "Custo total do projeto", t.valorTotalBruto, true);

  // ---------- Rodapé ----------
  r += 1;
  ws.mergeCells(`A${r}:L${r}`);
  ws.getCell(`A${r}`).value =
    `Validade: ${ec.validadeDias} dias. Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto.`;
  ws.getCell(`A${r}`).font = { italic: true, size: 9, color: { argb: COR.ink2 } };
  ws.getCell(`A${r}`).alignment = { wrapText: true };

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo(ec.numero)}.xlsx`);
}
