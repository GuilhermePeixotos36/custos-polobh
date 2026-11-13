/**
 * O contrato em PDF, do clique ao arquivo na pasta do projeto (11/11/2026).
 *
 * Três passos, e a ordem importa:
 *  1. `prepararContratoPdf` monta o contrato da OS, descobre em que VERSÃO ele
 *     está (ver `domain/versaoContrato`) e gera o PDF — é o que o "Visualizar
 *     Contrato" mostra e o que o "Emitir Contrato PDF" envia, os dois idênticos;
 *  2. `emitirContratoPdf` manda o arquivo para a pasta Dropbox do projeto — o
 *     contrato NÃO vai para os downloads da máquina de cada um;
 *  3. quem chamou grava na OS a versão emitida (ver `ContratoOs.versaoEmitida`).
 *
 * A biblioteca de PDF é grande e o contrato é um documento que a maioria das
 * telas nunca abre: entra por `import()`, só aqui.
 */
import { repo } from "@/data";
import type { Cliente, Ec, EmpresaGrupo, Os } from "@/data/types";
import { tituloContrato } from "@/domain/calc";
import { montarContrato, type ContratoDocumento } from "@/domain/contratoDocumento";
import { impressaoDeConteudo } from "@/domain/impressaoEc";
import { idsLinhasDoContrato } from "@/domain/os";
import { TESTEMUNHAS_PADRAO, testemunhasDaConfig, type TestemunhaFixa } from "@/domain/testemunhasContrato";
import { versaoDoContrato } from "@/domain/versaoContrato";
import { salvarArquivoNaPasta, type ResultadoPasta } from "@/lib/arquivarDocumento";
import { nomeArquivo } from "@/lib/excel/shared";
import { comDadosAtuaisDoProjeto } from "@/lib/projetoAoVivo";

const CHAVE_TESTEMUNHAS = "testemunhas_contrato";

/** As testemunhas fixas da casa — as editadas em Configurações, ou as padrão. */
export async function testemunhasDaCasa(): Promise<TestemunhaFixa[]> {
  try {
    return testemunhasDaConfig(await repo.config.ler<TestemunhaFixa[]>(CHAVE_TESTEMUNHAS));
  } catch {
    return TESTEMUNHAS_PADRAO;
  }
}

export async function gravarTestemunhasDaCasa(lista: TestemunhaFixa[]): Promise<void> {
  await repo.config.gravar(CHAVE_TESTEMUNHAS, lista);
}

export interface PreparoContrato {
  contrato: ContratoDocumento;
  bytes: Uint8Array;
  /** Nome do arquivo, com a extensão. */
  nome: string;
  versao: number;
  /** A impressão digital do conteúdo — o que se grava na OS ao emitir. */
  impressao: string;
  /** Esta versão já foi emitida (conteúdo igual ao da última emissão). */
  jaEmitido: boolean;
}

export async function prepararContratoPdf(
  os: Os,
  ec: Ec,
  ctx: { cliente: Cliente; empresas: EmpresaGrupo[] }
): Promise<PreparoContrato> {
  // Os DADOS GERAIS DO PROJETO e o cadastro do cliente, como estão AGORA (13/11/2026).
  // A OS carrega uma cópia de quando foi criada; o projeto incentivado, a lei, o
  // código e o endereço do cliente preenchidos depois não chegavam ao contrato.
  const viva = await comDadosAtuaisDoProjeto(ec);
  ec = viva;
  os = { ...os, projeto: viva.projeto };
  ctx = { ...ctx, cliente: viva.cliente ?? ctx.cliente };
  const testemunhas = await testemunhasDaCasa();
  // O conteúdo, sem o título (que leva a versão): é ele que diz se o contrato mudou.
  const semTitulo = montarContrato(os, { ...ctx, testemunhas });
  const impressao = impressaoDeConteudo({ ...semTitulo, tituloDocumento: undefined });
  const { versao, jaEmitido } = versaoDoContrato(os.contrato, impressao);

  const dataContrato = os.contrato.dataContrato || new Date().toISOString().slice(0, 10);
  const titulo = tituloContrato(ec, os.fornecedor, versao, dataContrato, idsLinhasDoContrato(os, ec.linhas));
  const contrato = montarContrato(os, { ...ctx, testemunhas, titulo });

  const { gerarContratoPdf } = await import("@/lib/pdf/contrato");
  return { contrato, bytes: await gerarContratoPdf(contrato), nome: `${nomeArquivo(titulo)}.pdf`, versao, impressao, jaEmitido };
}

export const blobDoPdf = (bytes: Uint8Array): Blob => new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });

/**
 * Manda o PDF para a pasta do projeto. O nome leva a versão, então uma versão
 * nova é um arquivo novo — nada é substituído, e "já existia" quer dizer que
 * esta mesma versão já estava lá.
 */
export function emitirContratoPdf(projetoId: string | undefined, p: PreparoContrato): Promise<ResultadoPasta> {
  return salvarArquivoNaPasta(projetoId, p.nome, blobDoPdf(p.bytes), { seExistir: "pular" });
}
