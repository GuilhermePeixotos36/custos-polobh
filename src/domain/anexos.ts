/**
 * Anexos leves nos comentários das tarefas do check-list.
 *
 * A conversa da tarefa é onde a produção combina o que fazer — e metade do que
 * se combina vem com um papel junto: a foto da planta do local, o PDF do
 * orçamento que chegou, a planilha do buffet. Sem onde pendurar isso, o arquivo
 * ia parar no WhatsApp e a decisão ficava aqui, separada da prova.
 *
 * "Leve" é a palavra-chave, e ela é uma REGRA, não um pedido: o arquivo grande
 * é caro de guardar, lento de abrir no celular no meio do evento e quase sempre
 * é o vídeo que não precisava estar ali. O limite vale nos dois lados — nesta
 * peneira, antes de subir, e no próprio bucket do Supabase, que recusa o que
 * passar.
 *
 * Só o check-list tem anexo. EC e OS continuam sem: lá o documento é o que a
 * planilha e a OS impressa dizem, e um arquivo solto na thread criaria uma
 * segunda versão da verdade num papel que vai para cliente e fornecedor.
 */

/** Teto por arquivo. Cabe foto de celular e PDF de orçamento; não cabe vídeo. */
export const TAMANHO_MAXIMO_ANEXO = 5 * 1024 * 1024;

/** Quantos arquivos cabem num comentário — o resto vira comentário novo. */
export const MAXIMO_ANEXOS_POR_COMENTARIO = 5;

/**
 * O que se aceita, por extensão.
 *
 * É uma lista de PERMITIDOS, não de proibidos: ninguém consegue prever o que
 * inventam de subir, mas dá para dizer o que a produção realmente usa. Ficam de
 * fora, de propósito, os formatos que o navegador EXECUTA (html, svg, js) — um
 * anexo é para ser lido, nunca para rodar.
 *
 * O MIME acompanha porque o celular às vezes manda o arquivo sem tipo nenhum, e
 * o bucket recusa o que chega como "application/octet-stream".
 */
export const TIPOS_ACEITOS: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
};

/** Valor do `accept` do seletor de arquivo — filtra já na janela do sistema. */
export const ACCEPT_ANEXOS = Object.keys(TIPOS_ACEITOS).map((e) => `.${e}`).join(",");

/** Lista dos tipos para o bucket e para a mensagem de erro. */
export const MIMES_ACEITOS = [...new Set(Object.values(TIPOS_ACEITOS))];

export const extensaoDe = (nome: string): string => {
  const partes = (nome || "").toLowerCase().split(".");
  return partes.length > 1 ? partes.pop()! : "";
};

/**
 * Tipo com que o arquivo sobe.
 *
 * O que o navegador diz vale, MENOS quando ele não sabe (vazio ou o genérico
 * "octet-stream", comum em anexo vindo do celular) — aí manda a extensão, que
 * já passou pela peneira.
 */
export function tipoDoAnexo(arquivo: { name: string; type?: string }): string {
  const declarado = (arquivo.type ?? "").trim();
  const pelaExtensao = TIPOS_ACEITOS[extensaoDe(arquivo.name)] ?? "";
  if (!declarado || declarado === "application/octet-stream") return pelaExtensao;
  return declarado;
}

/** Tamanho como a pessoa lê: "820 KB", "1,4 MB". */
export function tamanhoLegivel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Por que este arquivo não pode subir — ou `null` quando pode.
 *
 * Devolve o motivo pronto para a tela: quem escolheu o arquivo errado precisa
 * saber o que fazer, não que "falhou".
 */
export function motivoRecusaAnexo(
  arquivo: { name: string; size: number; type?: string },
  jaAnexados = 0
): string | null {
  if (jaAnexados >= MAXIMO_ANEXOS_POR_COMENTARIO) {
    return `Cada comentário aceita até ${MAXIMO_ANEXOS_POR_COMENTARIO} arquivos. Escreva outro comentário para os demais.`;
  }
  const ext = extensaoDe(arquivo.name);
  if (!ext || !TIPOS_ACEITOS[ext]) {
    return `"${arquivo.name}" não é um tipo aceito. Vale imagem, PDF, Word, Excel, PowerPoint, CSV e TXT.`;
  }
  if (arquivo.size <= 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
    return `"${arquivo.name}" tem ${tamanhoLegivel(arquivo.size)} — o limite é ${tamanhoLegivel(TAMANHO_MAXIMO_ANEXO)} por arquivo.`;
  }
  return null;
}

/**
 * Nome seguro para o caminho no bucket.
 *
 * O nome ORIGINAL continua guardado à parte, e é ele que a pessoa vê e baixa —
 * este aqui só existe para o caminho não ter acento, espaço nem barra, que
 * viram problema em URL e em pasta.
 */
export function nomeSeguroAnexo(nome: string): string {
  const limpo = (nome || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return limpo || "arquivo";
}

/**
 * Onde o arquivo mora no bucket: uma pasta por tarefa.
 *
 * Agrupar por tarefa é o que permite varrer e apagar tudo de uma vez quando a
 * tarefa some, e deixa o caminho legível na hora de investigar.
 */
export const caminhoAnexo = (itemId: string, id: string, nome: string): string =>
  `${itemId}/${id}-${nomeSeguroAnexo(nome)}`;

/** Ícone (emoji) do tipo — dá para reconhecer o anexo antes de abrir. */
export function iconeAnexo(nome: string): string {
  const ext = extensaoDe(nome);
  if (["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["doc", "docx", "txt"].includes(ext)) return "📄";
  if (["ppt", "pptx"].includes(ext)) return "📽️";
  return "📎";
}
