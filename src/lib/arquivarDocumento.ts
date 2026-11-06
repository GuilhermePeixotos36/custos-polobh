/**
 * Envia uma cópia do documento gerado para a pasta Dropbox do projeto (link em
 * Dados Gerais). Nunca lança: o arquivamento não pode travar a geração do
 * documento — quem chama mostra o aviso se `ok` for false.
 * Servidor: supabase/functions/arquivar-documento.
 */
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/store/toast";

export interface OpcoesArquivo {
  /**
   * "pular": se já houver na pasta um arquivo com o mesmo nome, não envia de
   * novo. Para EC e OS, cujo nome já carrega a versão — o mesmo nome é a mesma
   * versão, e o Dropbox criava "(1)", "(2)" a cada clique (06/11/2026).
   */
  seExistir?: "pular";
}

export async function arquivarDocumento(
  projetoId: string,
  nomeArquivo: string,
  conteudo: Blob,
  opts: OpcoesArquivo = {},
): Promise<{ ok: boolean; erro?: string; caminho?: string; jaExistia?: boolean }> {
  try {
    const bytes = new Uint8Array(await conteudo.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const { data, error } = await supabase.functions.invoke("arquivar-documento", {
      body: { projetoId, nomeArquivo, conteudoBase64: btoa(bin), seExistir: opts.seExistir },
    });
    if (error) return { ok: false, erro: error.message };
    return data?.ok ? { ok: true, caminho: data.caminho, jaExistia: !!data.jaExistia } : { ok: false, erro: data?.erro ?? "Falha ao arquivar." };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Cópia automática de um documento recém-gerado para a pasta Dropbox do projeto.
 * Não espera nem trava: roda em segundo plano depois do download. Projeto sem
 * link de pasta (ou sem projeto) simplesmente não arquiva, sem aviso — o link é
 * opcional. Falha real de envio vira um aviso na tela.
 */
export function arquivarCopia(
  projetoId: string | undefined,
  nome: string,
  buffer: ArrayBuffer,
  /** Chamado só quando a cópia chegou de fato à pasta. */
  onArquivado?: () => void,
  opts: OpcoesArquivo = {},
): void {
  void (async () => {
    const r = await salvarNaPasta(projetoId, nome, buffer, opts);
    if (r.status === "ok") {
      toast("Cópia salva na pasta Dropbox do projeto.", "success");
      onArquivado?.();
    } else if (r.status === "ja-existia") onArquivado?.();
    else if (r.status === "erro") toast(`Não foi possível salvar no Dropbox do projeto: ${r.erro}`, "info");
  })();
}

export type ResultadoPasta =
  | { status: "ok" | "ja-existia"; caminho?: string }
  | { status: "sem-pasta" }
  | { status: "erro"; erro: string };

/**
 * Envia o Excel para a pasta do projeto e ESPERA a resposta — para o botão
 * "Salvar na pasta", que precisa dizer à pessoa se deu certo. Nunca lança.
 */
export async function salvarNaPasta(
  projetoId: string | undefined,
  nome: string,
  buffer: ArrayBuffer,
  opts: OpcoesArquivo = {},
): Promise<ResultadoPasta> {
  if (!projetoId || !/^[0-9a-f-]{36}$/i.test(projetoId)) return { status: "sem-pasta" };
  try {
    const { data } = await supabase.from("projetos").select("docs_url").eq("id", projetoId).maybeSingle();
    if (!/^https?:\/\//i.test((data?.docs_url ?? "").trim())) return { status: "sem-pasta" };
    const r = await arquivarDocumento(projetoId, nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`, new Blob([buffer], { type: XLSX_MIME }), opts);
    if (!r.ok) return { status: "erro", erro: r.erro ?? "Falha ao arquivar." };
    return { status: r.jaExistia ? "ja-existia" : "ok", caminho: r.caminho };
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }
}
