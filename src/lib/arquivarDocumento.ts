/**
 * Envia uma cópia do documento gerado para a pasta Dropbox do projeto (link em
 * Dados Gerais). Nunca lança: o arquivamento não pode travar a geração do
 * documento — quem chama mostra o aviso se `ok` for false.
 * Servidor: supabase/functions/arquivar-documento.
 */
import { supabase } from "@/lib/supabaseClient";

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
