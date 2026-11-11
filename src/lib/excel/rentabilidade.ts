/**
 * A RENTABILIDADE em Excel — a mesma tabela da tela, para levar à reunião.
 *
 * Pedido de 15/09/2026 ("criar sistema para geração de planilha Rentabilidade
 * em Excel e PDF a partir desta aba"). O conteúdo vem do MESMO cálculo da tela
 * (`domain/rentabilidade`): duas leituras diferentes da margem, uma na tela e
 * outra na planilha, seria o tipo de divergência que ninguém percebe até a
 * reunião em que os dois números aparecem juntos.
 *
 * Ela é INTERNA — a margem da casa não vai para cliente nenhum —, e por isso não
 * carrega o bloco contratual da EC nem a assinatura do fornecedor. O cabeçalho
 * diz de que EC ela saiu, que é o que se precisa para conferir.
 */
import ExcelJS from "exceljs";
import type { Ec } from "@/data/types";
import { calcularRentabilidade } from "@/domain/rentabilidade";
import { COR, fill, thin, baixar, nomeArquivo } from "./shared";
import { rotuloNumeroEc } from "@/domain/calc";

const CINZA = "FFD9D9D9";
const COLS = ["A", "B", "C", "D", "E"];

export async function gerarRentabilidadeExcel(
  ec: Ec,
  gastoPorLinha: Record<string, number>
): Promise<void> {
  const r = calcularRentabilidade(ec, gastoPorLinha, ec.custosInternos ?? []);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("Rentabilidade", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 46 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 50 },
  ];

  let r1 = 1;
  const linha = (valores: (string | number)[], opts: { titulo?: boolean; cabecalho?: boolean; total?: boolean } = {}) => {
    const row = ws.getRow(r1);
    valores.forEach((v, i) => {
      const cel = row.getCell(i + 1);
      cel.value = v;
      cel.border = thin;
      cel.font = { name: "Calibri", size: 11, bold: !!(opts.titulo || opts.cabecalho || opts.total) };
      cel.alignment = { vertical: "middle", horizontal: i === 0 || i === 4 ? "left" : "right", wrapText: true };
      if (opts.titulo) cel.fill = fill(COR.amber);
      else if (opts.cabecalho || opts.total) cel.fill = fill(CINZA);
      if (typeof v === "number") cel.numFmt = i === 3 ? "0.0%" : 'R$ #,##0.00';
    });
    row.commit?.();
    return r1++;
  };

  ws.mergeCells(`A${r1}:${COLS[4]}${r1}`);
  linha([`RENTABILIDADE — ${rotuloNumeroEc(ec.numero)}`, "", "", "", ""], { titulo: true });
  ws.mergeCells(`A${r1}:${COLS[4]}${r1}`);
  linha([`Cliente: ${ec.cliente?.razaoSocial || ec.cliente?.nome || ""} · Projeto: ${ec.projeto?.titulo || ""}`, "", "", "", ""]);

  linha(["Item", "Valor na EC", "Valor Líquido OS", "Rentabilidade", "Justificativa"], { cabecalho: true });

  let grupoAtual = "";
  for (const l of r.linhas) {
    if (l.grupo !== grupoAtual) {
      grupoAtual = l.grupo;
      ws.mergeCells(`A${r1}:${COLS[4]}${r1}`);
      linha([grupoAtual, "", "", "", ""], { cabecalho: true });
    }
    linha([l.item, l.valorEc, l.valorLiquidoOs, l.percent ?? "", l.justificativa]);
  }

  linha([
    "Total do projeto",
    r.totalEc,
    r.totalLiquidoOs,
    r.percentSobreEc ?? "",
    "Percentual calculado sobre o valor total da EC",
  ], { total: true });

  ws.pageSetup.printArea = `A1:${COLS[4]}${r1 - 1}`;

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  baixar(buffer, `${nomeArquivo(`Rentabilidade ${rotuloNumeroEc(ec.numero)}`)}.xlsx`);
}
