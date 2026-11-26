/**
 * O helper ÚNICO de download do app (padrão de Logs, ponto de captura 6 — 26/11/2026).
 *
 * Toda exportação passa por aqui, e é por isso que ela aparece em Logs › Atividades: quem baixou o
 * quê, de que tela. Arquivo novo que o app passar a gerar chama `baixarArquivo`; impressão
 * (Baixar PDF pela janela do navegador) chama `registrarImpressao`.
 */
import { registrarExportacao } from "./registrarLog";

export function baixarArquivo(blob: Blob, nome: string, oQue: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sem isto o blob fica na memória da aba até ela ser fechada.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  registrarExportacao(undefined, oQue, { arquivo: nome });
}

/** A janela de impressão do navegador (o "Baixar PDF" da EC e da OS). */
export function imprimirPagina(oQue: string): void {
  registrarExportacao(undefined, oQue);
  window.print();
}
