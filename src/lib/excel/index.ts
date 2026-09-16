import type { Ec, Os } from "@/data/types";
import type { CronogramaExcelDados } from "./cronograma";
import { auditar } from "@/store/logs";
import { empresaPadrao, useEmpresas } from "@/store/empresas";
import { nomeEcExcel } from "./nomeEc";

export type ModeloEcExcel = "financeiro" | "completa";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ArquivoExcelHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

export interface DestinoEcExcel {
  nome: string;
  handle?: ArquivoExcelHandle;
}

/** Abre o Explorer antes de qualquer processamento assíncrono, preservando a ativação do clique. */
export async function escolherDestinoEcExcel(ec: Ec, modelo: ModeloEcExcel = "completa"): Promise<DestinoEcExcel | null> {
  const nome = nomeEcExcel(ec, modelo);
  const w = window as Window & {
    showSaveFilePicker?: (opts: unknown) => Promise<ArquivoExcelHandle>;
  };
  if (!w.showSaveFilePicker) return { nome };
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: nome,
      types: [{ description: "Planilha Excel", accept: { [XLSX_MIME]: [".xlsx"] } }],
    });
    return { nome, handle };
  } catch (erro) {
    if ((erro as Error)?.name === "AbortError") return null;
    return { nome };
  }
}

export async function salvarEcExcelNoDestino(
  ec: Ec,
  destino: DestinoEcExcel,
  modelo: ModeloEcExcel = "completa"
): Promise<"salvo" | "baixado"> {
  const [{ criarEcExcelBuffer }, { baixar }] = await Promise.all([import("./ec"), import("./shared")]);
  const { buffer } = await criarEcExcelBuffer(ec, modelo);
  if (destino.handle) {
    const writable = await destino.handle.createWritable();
    await writable.write(new Blob([buffer], { type: XLSX_MIME }));
    await writable.close();
    return "salvo";
  }
  baixar(buffer, destino.nome);
  return "baixado";
}

/** Geração da EC em Excel (ExcelJS carregado sob demanda).
 *  Com `opts.picker`, abre o seletor de pasta do sistema (Windows Explorer). */
export async function gerarEcExcel(
  ec: Ec,
  opts?: { picker?: boolean; modelo?: ModeloEcExcel }
): Promise<"salvo" | "cancelado" | "baixado"> {
  const { gerarEcExcel: fn } = await import("./ec");
  const r = await fn(ec, opts);
  if (r !== "cancelado") {
    const modelo = opts?.modelo === "financeiro" ? "financeiro" : "completo";
    auditar({ categoria: "Exportação", acao: "ec.excel", mensagem: `EC ${ec.numero} exportada para Excel (${modelo})`, alvoId: ec.id });
  }
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
  // A lista INTEIRA das empresas do grupo vai junto (15/09/2026): o tomador
  // pode ser a MF, e não só a emissora padrão (ver `domain/tomadorOs`).
  const r = await fn(os, ec, { ...opts, empresaPolobh, empresas: useEmpresas.getState().empresas });
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

/** Folha de contatos do evento (ExcelJS sob demanda). */
export async function gerarDadosUteisExcel(dados: import("./dadosUteis").DadosUteisExcel): Promise<void> {
  const { gerarDadosUteisExcel: fn } = await import("./dadosUteis");
  const r = await fn(dados);
  auditar({
    categoria: "Exportação",
    acao: "dadosUteis.excel",
    mensagem: `Dados Úteis exportados para Excel (${dados.titulo || dados.nomeArquivo})`,
  });
  return r;
}

/** Folha de credenciados para a portaria (ExcelJS sob demanda). */
export async function gerarCredenciamentoExcel(
  dados: import("./credenciamento").CredenciamentoExcelDados
): Promise<void> {
  const { gerarCredenciamentoExcel: fn } = await import("./credenciamento");
  const r = await fn(dados);
  auditar({
    categoria: "Exportação",
    acao: "credenciamento.excel",
    mensagem: `Credenciamento exportado para Excel (${dados.titulo || dados.nomeArquivo})`,
  });
  return r;
}

/** "Baixar PDF": usa a impressão do navegador sobre a visualização em tela.
 *  Funciona em qualquer navegador e mantém o armazenamento de arquivos mínimo. */
export function baixarPdfViaImpressao() {
  window.print();
}
