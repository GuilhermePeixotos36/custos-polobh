/**
 * O helper ÚNICO de download do app (padrão de Logs, 24/11/2026).
 *
 * Cada exportação baixava por conta própria (`createObjectURL` + âncora em três lugares: as
 * planilhas Excel, o back-up e o consumo de IA), e por isso nenhuma deixava rastro de "quem tirou
 * o quê do app". Agora todas passam por aqui, e é aqui que a exportação vai para a aba Atividades
 * da tela Logs — o nome do arquivo, o tipo e o tamanho, nunca o conteúdo.
 *
 * Exportação nova: monte o Blob e chame `baixarArquivo`. Procurar `createObjectURL` no código
 * deve achar este arquivo e as prévias de PDF que NÃO são download (iframe da prévia de contrato).
 */
import { registrarExportacao } from "@/lib/logs/registrarLog";

/** Liberar o endereço na mesma volta do clique cancela o download em parte dos navegadores. */
const LIBERAR_APOS_MS = 10_000;

export function baixarArquivo(
  nome: string,
  conteudo: Blob,
  opcoes: {
    /** Modelo em branco não é dado que saiu do app: não registra. */
    semRegistro?: boolean;
    /** O que identifica o recorte (aba, período, quantidade de linhas) — NUNCA as linhas. */
    detalhe?: Record<string, unknown>;
  } = {},
): void {
  if (!opcoes.semRegistro) {
    registrarExportacao(undefined, nome, { tipo: conteudo.type || undefined, bytes: conteudo.size, ...opcoes.detalhe });
  }
  const endereco = URL.createObjectURL(conteudo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.rel = "noopener";
  document.body.appendChild(link); // o Firefox ignora clique em âncora solta
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(endereco), LIBERAR_APOS_MS);
}
