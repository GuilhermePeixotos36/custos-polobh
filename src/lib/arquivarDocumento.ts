/**
 * Envia uma cópia do documento gerado para a pasta Dropbox do projeto (link em
 * Dados Gerais). Nunca lança: o arquivamento não pode travar a geração do
 * documento — quem chama mostra o aviso se `ok` for false.
 * Servidor: supabase/functions/arquivar-documento.
 */
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/store/toast";

export async function arquivarDocumento(
  projetoId: string,
  nomeArquivo: string,
  conteudo: Blob
): Promise<{ ok: boolean; erro?: string; caminho?: string }> {
  try {
    const bytes = new Uint8Array(await conteudo.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const { data, error } = await supabase.functions.invoke("arquivar-documento", {
      body: { projetoId, nomeArquivo, conteudoBase64: btoa(bin) },
    });
    if (error) return { ok: false, erro: error.message };
    return data?.ok ? { ok: true, caminho: data.caminho } : { ok: false, erro: data?.erro ?? "Falha ao arquivar." };
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
): void {
  if (!projetoId || !/^[0-9a-f-]{36}$/i.test(projetoId)) return;
  void (async () => {
    try {
      const { data } = await supabase.from("projetos").select("docs_url").eq("id", projetoId).maybeSingle();
      if (!/^https?:\/\//i.test((data?.docs_url ?? "").trim())) return;
      const r = await arquivarDocumento(projetoId, nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`, new Blob([buffer], { type: XLSX_MIME }));
      if (r.ok) {
        toast("Cópia salva na pasta Dropbox do projeto.", "success");
        onArquivado?.();
      }
      else toast(`Não foi possível salvar no Dropbox do projeto: ${r.erro}`, "info");
    } catch {
      /* arquivar nunca atrapalha quem gerou o documento */
    }
  })();
}
