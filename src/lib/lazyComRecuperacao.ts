import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHAVE_RECARGA = "polobh:recarga-chunk";
const PADRAO_ERRO_CHUNK = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|module script.*mime type/i;

export function ehErroDeChunk(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro ?? "");
  return PADRAO_ERRO_CHUNK.test(mensagem);
}

/** Recarrega somente uma vez por URL para buscar o index e os chunks do deploy atual. */
export function tentarRecuperarErroDeChunk(erro: unknown): boolean {
  if (!ehErroDeChunk(erro)) return false;
  const tentativa = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (sessionStorage.getItem(CHAVE_RECARGA) === tentativa) return false;
  sessionStorage.setItem(CHAVE_RECARGA, tentativa);
  window.location.reload();
  return true;
}

export function limparTentativaDeRecarga(): void {
  sessionStorage.removeItem(CHAVE_RECARGA);
}

/** React.lazy com recuperação automática quando um deploy substitui os chunks abertos. */
export function lazyComRecuperacao<T extends ComponentType<Record<string, never>>>(
  importar: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const modulo = await importar();
      limparTentativaDeRecarga();
      return modulo;
    } catch (erro) {
      if (tentarRecuperarErroDeChunk(erro)) return new Promise<never>(() => undefined);
      throw erro;
    }
  });
}
