import type { Ec, Os } from "@/data/types";
import type { CronogramaExcelDados } from "./cronograma";
import { auditar } from "@/store/logs";
import { empresaPadrao } from "@/store/empresas";

/** Geração da EC em Excel (ExcelJS carregado sob demanda).
 *  Com `opts.picker`, abre o seletor de pasta do sistema (Windows Explorer). */
export async function gerarEcExcel(
  ec: Ec,
  opts?: { picker?: boolean }
): Promise<"salvo" | "cancelado" | "baixado"> {
  const { gerarEcExcel: fn } = await import("./ec");
  const r = await fn(ec, opts);
  if (r !== "cancelado")
    auditar({ categoria: "Exportação", acao: "ec.excel", mensagem: `EC ${ec.numero} exportada para Excel`, alvoId: ec.id });
  return r;
}

/** Geração da OS em Excel remontada com a marca (ExcelJS sob demanda). */
export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts?: { incluirFinanceiro?: boolean }
): Promise<void> {
  const { gerarOsExcel: fn } = await import("./os");
  // empresa emissora (Pólobh Promoções / MF Promoções) vem das Configurações
  const emp = empresaPadrao();
  const empresaPolobh = emp
    ? {
        nome: emp.nome,
        razaoSocial: emp.razaoSocial,
        cnpj: emp.cnpj,
        endereco: emp.endereco,
        inscricaoEstadual: emp.inscricaoEstadual,
        inscricaoMunicipal: emp.inscricaoMunicipal,
      }
    : undefined;
  const r = await fn(os, ec, { ...opts, empresaPolobh });
  auditar({
    categoria: "Exportação",
    acao: "os.excel",
    mensagem: `OS ${os.numero} exportada para Excel${opts?.incluirFinanceiro ? " (com financeiro)" : ""}`,
    alvoId: os.id,
  });
  return r;
}

/** Geração do Cronograma em Excel no modelo Pólobh (ExcelJS sob demanda). */
export async function gerarCronogramaExcel(dados: CronogramaExcelDados): Promise<void> {
  const { gerarCronogramaExcel: fn } = await import("./cronograma");
  const r = await fn(dados);
  auditar({
    categoria: "Exportação",
    acao: "cronograma.excel",
    mensagem: `Cronograma exportado para Excel (${dados.titulo || dados.nomeArquivo})`,
  });
  return r;
}

/** "Baixar PDF": usa a impressão do navegador sobre a visualização em tela.
 *  Funciona em qualquer navegador e mantém o armazenamento de arquivos mínimo. */
export function baixarPdfViaImpressao() {
  window.print();
}
