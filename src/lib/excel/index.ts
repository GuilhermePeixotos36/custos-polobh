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

/**
 * A rentabilidade em Excel (15/09/2026) — planilha INTERNA, com a margem da
 * casa. ExcelJS sob demanda, como as outras.
 */
export async function gerarRentabilidadeExcel(ec: Ec, gastoPorLinha: Record<string, number>): Promise<void> {
  const { gerarRentabilidadeExcel: fn } = await import("./rentabilidade");
  await fn(ec, gastoPorLinha);
  auditar({
    categoria: "Exportação",
    acao: "ec.rentabilidade.excel",
    mensagem: `Rentabilidade da EC ${ec.numero} exportada para Excel`,
    alvoId: ec.id,
  });
}

/**
 * Empresa emissora e empresas do grupo que entram na OS em Excel — as mesmas no
 * download e na cópia arquivada, para as duas saírem iguais.
 */
function opcoesDeEmpresaDaOs() {
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
  return { empresaPolobh, empresas: useEmpresas.getState().empresas };
}

/** Geração da OS em Excel remontada com a marca (ExcelJS sob demanda). */
export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts?: { incluirFinanceiro?: boolean }
): Promise<void> {
  const { gerarOsExcel: fn } = await import("./os");
  const r = await fn(os, ec, { ...opts, ...opcoesDeEmpresaDaOs() });
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

/**
 * A OS "oficial" é o PDF, que sai pela impressão do navegador — e a impressão
 * não entrega um arquivo que o app possa copiar. Então, ao baixar o PDF, a
 * pasta Dropbox do projeto recebe a OS em Excel (sem financeiro) como cópia.
 */
export async function arquivarOsNoProjeto(os: Os, ec: Ec): Promise<void> {
  try {
    const [{ criarOsExcelBuffer }, { arquivarCopia }] = await Promise.all([import("./os"), import("@/lib/arquivarDocumento")]);
    const { buffer, nome } = await criarOsExcelBuffer(os, ec, { incluirFinanceiro: false, ...opcoesDeEmpresaDaOs() });
    arquivarCopia(ec.projetoId, nome, buffer);
  } catch {
    /* arquivar nunca atrapalha o download */
  }
}

/**
 * NOVA VERSÃO de OS ou de EC também vai para a pasta do Dropbox (01/10/2026).
 *
 * Até aqui só o DOWNLOAD de um documento arquivava a cópia. Gerar nova versão —
 * pelo botão da EC ou pelo Alerta de alteração dos Dados Gerais — não baixa
 * arquivo nenhum, então a versão nascia no sistema e nunca chegava à pasta: o
 * projeto tinha o link certo e nada era salvo. Agora a versão recém-criada é
 * montada em Excel e arquivada, no mesmo formato das cópias de download (a OS
 * sem financeiro; a EC no modelo completo).
 *
 * Nunca lança: arquivar não pode atrapalhar quem gerou a versão. Projeto sem
 * link de pasta não arquiva (e a pendência "falta o link" cobra o produtor).
 */
export async function arquivarNovaVersaoOs(os: Os, ec: Ec): Promise<void> {
  await arquivarOsNoProjeto(os, ec);
}

export async function arquivarNovaVersaoEc(ec: Ec): Promise<void> {
  try {
    const [{ criarEcExcelBuffer }, { arquivarCopia }] = await Promise.all([import("./ec"), import("@/lib/arquivarDocumento")]);
    const { buffer, nome } = await criarEcExcelBuffer(ec, "completa");
    arquivarCopia(ec.projetoId, nome, buffer);
  } catch {
    /* arquivar nunca atrapalha a geração da versão */
  }
}
