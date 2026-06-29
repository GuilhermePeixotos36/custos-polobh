/**
 * Geração da OS em Excel — remontada com a marca Pólobh (mesmo padrão visual
 * da EC), seguindo os 9 blocos do documento FASE 1 (requisitos da Pólobh).
 * Não usa mais o template cru: monta um documento limpo e branded.
 */
import ExcelJS from "exceljs";
import type { Ec, Os } from "@/data/types";
import { dataBR } from "@/lib/format";
import { COR, fill, thin, baixar, nomeArquivo, carregarLogo } from "./shared";

const COLS = ["A", "B", "C", "D", "E", "F"] as const;
const moeda = '"R$" #,##0.00';

export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean } = {}
): Promise<void> {
  const incluirFinanceiro = opts.incluirFinanceiro ?? true;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("OS", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  [24, 16, 16, 15, 15, 15].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  let r = 1;

  /* ----------------------------- helpers ----------------------------- */
  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:F${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 11, color: { argb: COR.white } };
    c.fill = fill(COR.primary);
    c.alignment = { vertical: "middle" };
    ws.getRow(r).height = 20;
    r++;
  };

  const lv = (label: string, valor: string | number | null | undefined, moneyFmt = false) => {
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { bold: true, size: 10 };
    a.fill = fill(COR.soft);
    a.alignment = { vertical: "top", wrapText: true };
    a.border = thin;
    ws.mergeCells(`B${r}:F${r}`);
    const b = ws.getCell(`B${r}`);
    b.value = (valor ?? "") as ExcelJS.CellValue;
    b.font = { size: 10 };
    b.alignment = { wrapText: true, vertical: "top" };
    b.border = thin;
    if (moneyFmt && typeof valor === "number") {
      b.numFmt = moeda;
      b.alignment = { vertical: "top", horizontal: "left" };
    }
    r++;
  };

  /** Cabeçalho de tabela (faixa preta) nas colunas indicadas. */
  const headerRow = (cols: { texto: string; span: string; align?: "left" | "right" }[]) => {
    for (const col of cols) {
      ws.mergeCells(col.span);
      const c = ws.getCell(col.span.split(":")[0]);
      c.value = col.texto;
      c.font = { bold: true, size: 9, color: { argb: COR.white } };
      c.fill = fill(COR.black);
      c.alignment = { vertical: "middle", horizontal: col.align ?? "left", wrapText: true };
      c.border = thin;
    }
    ws.getRow(r).height = 18;
    r++;
  };

  /* ----------------------------- cabeçalho ---------------------------- */
  ws.mergeCells(`A${r}:B${r + 1}`);
  ws.mergeCells(`C${r}:F${r + 1}`);
  const tit = ws.getCell(`C${r}`);
  tit.value = "Ordem de Serviço";
  tit.font = { name: "Calibri", size: 16, bold: true, color: { argb: COR.white } };
  tit.alignment = { vertical: "middle", horizontal: "center" };
  COLS.forEach((c) => {
    ws.getCell(`${c}${r}`).fill = fill(COR.black);
    ws.getCell(`${c}${r + 1}`).fill = fill(COR.black);
  });
  ws.getRow(r).height = 26;
  ws.getRow(r + 1).height = 26;
  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo as ArrayBuffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.2, row: r - 0.85 }, ext: { width: 110, height: 50 } });
  }
  r += 2;

  // meta
  lv("Número da OS:", os.numero);
  lv("Projeto:", ec.projeto.titulo);
  lv("Data de emissão:", dataBR(new Date().toISOString()));
  lv("Status:", os.status);

  /* ---------------------- 1. Dados do cliente (EC) -------------------- */
  const cli = ec.cliente;
  secao("DADOS DO CLIENTE  (automático da EC)");
  lv("Cliente:", cli.nome);
  lv("Razão Social:", cli.razaoSocial);
  lv("Endereço:", cli.endereco);
  lv("CNPJ/CPF:", cli.cnpjCpf);
  if (cli.inscricaoEstadual) lv("Inscrição Estadual:", cli.inscricaoEstadual);
  if (cli.inscricaoMunicipal) lv("Inscrição Municipal:", cli.inscricaoMunicipal);

  /* ---------------------- 2. Dados do projeto (EC) -------------------- */
  const p = ec.projeto;
  secao("DADOS DO PROJETO  (automático da EC)");
  if (p.incentivosFiscais) lv("Incentivos Fiscais:", p.incentivosFiscais);
  lv("Data / Horário:", `${dataBR(p.evento)} · ${p.horario}`);
  lv("Local:", p.local);
  if (p.enderecoLocal) lv("Endereço do Local:", p.enderecoLocal);
  lv("Nº de Participantes:", p.participantes ?? "");
  lv("Produtora Responsável:", p.produtoraResponsavel);
  lv("Contato Produtora:", [p.telefoneProdutora, p.emailProdutora].filter(Boolean).join(" · "));

  /* ----------------- 3. Itens consolidados da EC --------------------- */
  const consolidadas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  secao("ITENS CONSOLIDADOS DA EC");
  headerRow([
    { texto: "Grupo", span: `A${r}:A${r}` },
    { texto: "Item / Descrição", span: `B${r}:D${r}` },
    { texto: "Pólobh", span: `E${r}:E${r}`, align: "right" },
    { texto: "Cliente", span: `F${r}:F${r}`, align: "right" },
  ]);
  for (const l of consolidadas) {
    ws.getCell(`A${r}`).value = l.grupo;
    ws.mergeCells(`B${r}:D${r}`);
    ws.getCell(`B${r}`).value = `${l.item ? l.item + " — " : ""}${l.descricao}`;
    const cp = ws.getCell(`E${r}`); cp.value = l.valorPolobh; cp.numFmt = moeda;
    const cc = ws.getCell(`F${r}`); cc.value = l.valorCliente; cc.numFmt = moeda;
    [`A${r}`, `B${r}`, `E${r}`, `F${r}`].forEach((a) => {
      ws.getCell(a).border = thin;
      ws.getCell(a).font = { size: 9 };
      ws.getCell(a).alignment = { wrapText: true, vertical: "top" };
    });
    r++;
  }
  // total consolidado
  ws.mergeCells(`A${r}:D${r}`);
  ws.getCell(`A${r}`).value = "Total consolidado";
  ws.getCell(`A${r}`).font = { bold: true, size: 9 };
  ws.getCell(`A${r}`).fill = fill(COR.soft);
  const tp = ws.getCell(`E${r}`); tp.value = consolidadas.reduce((s, l) => s + l.valorPolobh, 0); tp.numFmt = moeda; tp.font = { bold: true, size: 9 };
  const tc = ws.getCell(`F${r}`); tc.value = consolidadas.reduce((s, l) => s + l.valorCliente, 0); tc.numFmt = moeda; tc.font = { bold: true, size: 9 };
  [`A${r}`, `E${r}`, `F${r}`].forEach((a) => (ws.getCell(a).border = thin));
  ws.getCell(`E${r}`).fill = fill(COR.soft);
  ws.getCell(`F${r}`).fill = fill(COR.soft);
  r++;

  /* ----------------------- 4. Dados do fornecedor -------------------- */
  const f = os.fornecedor;
  const b = f.dadosBancarios;
  secao("DADOS DO FORNECEDOR");
  lv("Fornecedor:", f.nomeFantasia || f.razaoSocial);
  lv("CNPJ/CPF:", f.cnpj);
  lv("Perfil tributário:", f.perfilTributario);
  lv("Razão Social:", f.razaoSocial);
  lv("Endereço:", f.endereco);
  if (f.inscricaoEstadual) lv("Inscrição Estadual:", f.inscricaoEstadual);
  if (f.inscricaoMunicipal) lv("Inscrição Municipal:", f.inscricaoMunicipal);
  lv("Dados Bancários:", [b.tipoConta, b.banco, b.agencia && `Ag. ${b.agencia}`, b.conta && `Conta ${b.conta}`, b.chavePix && `Pix ${b.chavePix}`].filter(Boolean).join("  ·  "));
  lv("Representante:", f.representante);
  lv("Contato:", [f.telefone, f.email].filter(Boolean).join(" · "));

  /* ------------------- 5. Detalhamento da contratação ---------------- */
  secao("DETALHAMENTO DA CONTRATAÇÃO");
  lv("Modalidade:", os.modalidade);
  lv("Descritivo:", os.descritivo);
  lv("Entrega:", os.entrega);

  // cronograma específico (grade)
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = "Cronograma específico do fornecedor";
  ws.getCell(`A${r}`).font = { bold: true, size: 9, italic: true, color: { argb: COR.ink2 } };
  r++;
  headerRow([
    { texto: "Etapa", span: `A${r}:B${r}` },
    { texto: "Data", span: `C${r}:C${r}` },
    { texto: "Horário", span: `D${r}:D${r}` },
    { texto: "Atividades", span: `E${r}:F${r}` },
  ]);
  const cron = [...os.cronograma].sort((a, c) => (a.data || "").localeCompare(c.data || ""));
  if (cron.length === 0) {
    ws.mergeCells(`A${r}:F${r}`);
    ws.getCell(`A${r}`).value = "Sem etapas cadastradas.";
    ws.getCell(`A${r}`).font = { size: 9, italic: true, color: { argb: COR.ink2 } };
    ws.getCell(`A${r}`).border = thin;
    r++;
  } else {
    for (const c of cron) {
      ws.mergeCells(`A${r}:B${r}`);
      ws.getCell(`A${r}`).value = c.etapa;
      ws.getCell(`C${r}`).value = dataBR(c.data);
      ws.getCell(`D${r}`).value = c.horario;
      ws.mergeCells(`E${r}:F${r}`);
      ws.getCell(`E${r}`).value = c.atividades;
      [`A${r}`, `C${r}`, `D${r}`, `E${r}`].forEach((a) => {
        ws.getCell(a).border = thin;
        ws.getCell(a).font = { size: 9 };
        ws.getCell(a).alignment = { wrapText: true, vertical: "top" };
      });
      r++;
    }
  }

  lv("Logística:", [
    os.logistica.transporteMaterial && `Transp. material: ${os.logistica.transporteMaterial}`,
    os.logistica.transporteEquipe && `Transp. equipe: ${os.logistica.transporteEquipe}`,
    os.logistica.hospedagem && `Hospedagem: ${os.logistica.hospedagem}`,
    os.logistica.alimentacao && `Alimentação: ${os.logistica.alimentacao}`,
    os.logistica.estacionamentoCarga && `Estac. carga: ${os.logistica.estacionamentoCarga}`,
    os.logistica.estacionamentoEquipe && `Estac. equipe: ${os.logistica.estacionamentoEquipe}`,
    os.logistica.uniformizacao && `Uniformização: ${os.logistica.uniformizacao}`,
  ].filter(Boolean).join("\n"));
  lv("Infraestrutura:", [
    os.infraestrutura.energia && `Energia: ${os.infraestrutura.energia}`,
    os.infraestrutura.internet && `Internet: ${os.infraestrutura.internet}`,
    os.infraestrutura.pontosEletricos && `Pontos elétricos: ${os.infraestrutura.pontosEletricos}`,
    os.infraestrutura.estruturas && `Estruturas: ${os.infraestrutura.estruturas}`,
    os.infraestrutura.servicosApoio && `Apoio: ${os.infraestrutura.servicosApoio}`,
    os.infraestrutura.artLaudos && `ART/Laudos: ${os.infraestrutura.artLaudos}`,
  ].filter(Boolean).join("\n"));
  if (os.observacoes) lv("Observações Gerais:", os.observacoes);

  /* ------------------------- 6. Credenciamento ----------------------- */
  secao("CREDENCIAMENTO");
  lv("Link do formulário:", os.credenciamento.linkFormulario);
  lv("Prazo limite:", dataBR(os.credenciamento.prazoLimite));

  /* ---------------------------- 7. Orçamento ------------------------- */
  secao("ORÇAMENTO");
  lv("Valor do item na EC:", os.orcamento.valorEc, true);
  lv("Valor com BV e NF:", os.orcamento.valorComBvNf, true);
  lv("Valor sem BV e com NF:", os.orcamento.valorSemBvComNf, true);
  lv("Valor sem BV e sem NF:", os.orcamento.valorSemBvSemNf, true);
  lv("Parcelas:", os.orcamento.parcelas.map((x, i) => `${i + 1}. ${x.descricao}: R$ ${x.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n"));
  lv("Documento Fiscal:", os.orcamento.documentoFiscal);

  /* --------------------- 8. Financeiro Pólobh ------------------------ */
  if (incluirFinanceiro) {
    const fin = os.financeiro;
    secao("FINANCEIRO PÓLOBH  (uso interno)");
    lv("Tomador:", fin.tomador === "Polobh" ? "Pólobh" : fin.tomador);
    if (fin.descritivoNf) lv("Descritivo NF:", fin.descritivoNf);
    lv("CNAE / Código de Serviço:", [fin.cnae, fin.codigoServico].filter(Boolean).join(" · "));
    lv("Valor unitário:", fin.valorUnitario, true);
    lv("Valor total:", fin.valorTotal, true);
    lv("Desconto negociado:", fin.descontoNegociado, true);
    lv("Valor total a pagar:", fin.valorAPagar, true);
    lv("BV Pólobh:", `${fin.bvPercentual}%  ·  R$ ${(fin.bvValor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (fin.acertoFinanceiro) lv("Acerto Financeiro:", fin.acertoFinanceiro);
  }

  /* ----------------------------- assinatura -------------------------- */
  r++;
  ws.getCell(`A${r}`).value = "Pólobh Eventos";
  ws.getCell(`A${r}`).border = { top: { style: "thin", color: { argb: COR.ink } } };
  ws.mergeCells(`D${r}:F${r}`);
  ws.getCell(`D${r}`).value = `${f.razaoSocial || "Fornecedor"} — Data: ____/____/______`;
  ws.getCell(`D${r}`).border = { top: { style: "thin", color: { argb: COR.ink } } };
  ws.getCell(`A${r}`).font = { size: 9 };
  ws.getCell(`D${r}`).font = { size: 9 };

  ws.pageSetup.printArea = `A1:F${r}`;

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo(os.numero)}.xlsx`);
}
