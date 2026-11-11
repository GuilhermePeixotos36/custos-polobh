import type { Ec, Os } from "@/data/types";
import type { CronogramaExcelDados } from "./cronograma";
import { auditar } from "@/store/logs";
import { empresaPadrao, useEmpresas } from "@/store/empresas";
import { nomeEcExcel } from "./nomeEc";
import { rotuloNumeroEc } from "@/domain/calc";

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
    // Baixar NÃO congela mais a versão nem copia para o Dropbox (06/11/2026):
    // quem faz isso é só o botão "Salvar na pasta" (ver `salvarEcNaPasta`).
    // Antes, cada download marcava a EC como baixada e toda edição seguinte
    // virava uma versão nova — a EC da Carol foi da v3 à v8 num dia.
    const modelo = opts?.modelo === "financeiro" ? "financeiro" : "completo";
    auditar({ categoria: "Exportação", acao: "ec.excel", mensagem: `EC ${rotuloNumeroEc(ec.numero)} exportada para Excel (${modelo})`, alvoId: ec.id });
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
    mensagem: `Rentabilidade da EC ${rotuloNumeroEc(ec.numero)} exportada para Excel`,
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
 * não entrega um arquivo que o app possa copiar. Então a pasta Dropbox do
 * projeto recebe a OS em Excel (sem financeiro) como cópia.
 *
 * UMA VEZ POR VERSÃO (06/11/2026): a cópia sai ao EMITIR a OS e ao gerar nova
 * versão — não mais a cada clique em "OS PDF" nem em cada download do Excel,
 * que geravam "OS (01) (1)", "(2)" na pasta. E se o arquivo da versão já
 * estiver lá, o servidor não envia de novo.
 */
export async function arquivarOsNoProjeto(os: Os, ec: Ec): Promise<void> {
  try {
    const [{ criarOsExcelBuffer }, { arquivarCopia }] = await Promise.all([import("./os"), import("@/lib/arquivarDocumento")]);
    const { buffer, nome } = await criarOsExcelBuffer(os, ec, { incluirFinanceiro: false, ...opcoesDeEmpresaDaOs() });
    arquivarCopia(ec.projetoId, nome, buffer, undefined, { seExistir: "pular" });
  } catch {
    /* arquivar nunca atrapalha quem emitiu */
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
    // Chegou à pasta = esta versão fica como está (ver `marcarBaixada`).
    arquivarCopia(ec.projetoId, nome, buffer, () => {
      void import("@/data").then(({ repo }) => repo.ecs.marcarBaixada(ec.id)).catch(() => {});
    }, { seExistir: "pular" });
  } catch {
    /* arquivar nunca atrapalha a geração da versão */
  }
}

/**
 * "SALVAR NA PASTA" da EC (06/11/2026): monta o Excel completo, envia para a
 * pasta Dropbox do projeto e ESPERA a resposta. Chegou (ou a mesma versão já
 * estava lá) = a versão fica registrada como arquivada (`marcarBaixada`), e a
 * próxima mudança que for para a pasta vira a versão seguinte.
 */
export async function salvarEcNaPasta(ec: Ec): Promise<import("@/lib/arquivarDocumento").ResultadoPasta> {
  const [{ criarEcExcelBuffer }, { salvarNaPasta }, { repo }] = await Promise.all([
    import("./ec"),
    import("@/lib/arquivarDocumento"),
    import("@/data"),
  ]);
  /*
   * OS DOIS MODELOS de uma vez (11/11/2026, pedido da Marisa): a Completa e a
   * Financeira, com a MESMA versão no nome — a reduzida leva " - Financeiro"
   * (ver `nomeEcExcel`). O botão de baixar o Excel saiu: a pasta do projeto é
   * onde a EC fica, e as duas planilhas sempre andam juntas.
   */
  const resultados: import("@/lib/arquivarDocumento").ResultadoPasta[] = [];
  const nomes: string[] = [];
  for (const modelo of ["completa", "financeiro"] as const) {
    const { buffer, nome } = await criarEcExcelBuffer(ec, modelo);
    nomes.push(nome);
    resultados.push(await salvarNaPasta(ec.projetoId, nome, buffer, { seExistir: "pular" }));
  }
  const erro = resultados.find((x) => x.status === "erro");
  const semPasta = resultados.find((x) => x.status === "sem-pasta");
  const r: import("@/lib/arquivarDocumento").ResultadoPasta =
    erro ?? semPasta ?? (resultados.every((x) => x.status === "ja-existia") ? { status: "ja-existia" } : { status: "ok" });
  /*
   * Chegou ALGUM arquivo à pasta = esta versão já está lá, e fica registrada
   * (11/11/2026). Se só uma das duas falhou, a nova tentativa sem edição cai no
   * "já está na pasta" e completa o par (o arquivo que existe é pulado, o que
   * falta sobe); com edição, vira a versão seguinte. Antes a versão não era
   * marcada, a pessoa editava e tentava de novo, e a pasta ficava com um par da
   * mesma versão com conteúdos diferentes.
   */
  const algumNaPasta = resultados.some((x) => x.status === "ok" || x.status === "ja-existia");
  if (algumNaPasta) await repo.ecs.marcarBaixada(ec.id).catch(() => {});
  if (r.status === "ok" || r.status === "ja-existia") {
    auditar({ categoria: "Exportação", acao: "ec.pasta", mensagem: `EC ${rotuloNumeroEc(ec.numero)} salva na pasta do projeto (${nomes.join(" e ")})`, alvoId: ec.id });
  }
  return r;
}
