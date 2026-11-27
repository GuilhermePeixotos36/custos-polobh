/**
 * A OS em PDF, do clique ao arquivo (27/11/2026).
 *
 * BAIXAR O PDF É EMITIR A OS. O arquivo é o que sai da casa: vai para a pasta
 * do projeto, desce para a máquina de quem emitiu e abre numa aba, pronto para
 * seguir por e-mail. Quem decide SE a OS pode ser emitida é a tela da OS
 * (`OsForm.emitirOs`, com as travas de pendência, contratação e incentivo);
 * aqui fica só a entrega do arquivo.
 *
 * A biblioteca de PDF é grande: entra por `import()`, só aqui.
 */
import type { Ec, Os } from "@/data/types";
import { montarOsDocumento } from "@/domain/osDocumento";
import { salvarArquivoNaPasta, type ResultadoPasta } from "@/lib/arquivarDocumento";
import { nomeArquivo } from "@/lib/excel/shared";
import { baixarArquivo } from "@/lib/logs/baixarArquivo";
import { comDadosAtuaisDoProjeto, osComDadosAtuais } from "@/lib/projetoAoVivo";
import { useEmpresas } from "@/store/empresas";

export interface OsPdfPronto {
  bytes: Uint8Array;
  /** Nome do arquivo, com a extensão — o nome da OS. */
  nome: string;
}

/** Gera o PDF da OS como ela está gravada, com os dados do projeto de agora (se ainda não emitida). */
export async function prepararOsPdf(os: Os, ec: Ec, restrito: boolean): Promise<OsPdfPronto> {
  const viva = await comDadosAtuaisDoProjeto(ec);
  const modelo = montarOsDocumento(osComDadosAtuais(os, viva), viva, { restrito, empresas: useEmpresas.getState().empresas });
  const { gerarOsPdf } = await import("@/lib/pdf/os");
  return { bytes: await gerarOsPdf(modelo, os.numero), nome: `${nomeArquivo(os.numero)}.pdf` };
}

const blobDoPdf = (bytes: Uint8Array): Blob => new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });

/**
 * Entrega o PDF da OS: salva na pasta do projeto (quando `naPasta`), baixa o
 * arquivo e tenta abri-lo numa aba. O nome leva a versão, então a mesma versão
 * não é enviada duas vezes à pasta. Devolve o que aconteceu na pasta, para quem
 * chamou avisar.
 */
export async function entregarOsPdf(
  os: Os,
  ec: Ec,
  opts: { restrito: boolean; naPasta: boolean }
): Promise<ResultadoPasta | null> {
  const pdf = await prepararOsPdf(os, ec, opts.restrito);
  const blob = blobDoPdf(pdf.bytes);
  const pasta = opts.naPasta ? await salvarArquivoNaPasta(ec.projetoId, pdf.nome, blob, { seExistir: "pular" }) : null;
  baixarArquivo(blob, pdf.nome, "OS em PDF");
  // A aba pode ser barrada pelo bloqueador de pop-up: o arquivo já desceu, então não é erro.
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return pasta;
}
