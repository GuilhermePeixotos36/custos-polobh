/**
 * Clique no aviso do sistema com o Pólobh JÁ ABERTO (12/11/2026).
 *
 * O service worker não navega a aba — manda este recado, e a navegação é feita
 * aqui, pela rota do app. Antes o worker chamava `aba.navigate()`, que recarrega
 * a página inteira: o que a pessoa estava digitando e ainda não salvou ia embora
 * sem o aviso de "alterações não salvas". Pela rota do React Router esse aviso
 * continua valendo.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Só caminhos do próprio app — o aviso nunca leva para fora do Pólobh. */
export function caminhoDoAviso(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function useAbrirDoAviso(ativo: boolean): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!ativo || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo !== "abrir-pendencia") return;
      const caminho = caminhoDoAviso(e.data.url);
      if (caminho) navigate(caminho);
    };
    navigator.serviceWorker.addEventListener("message", ouvir);
    return () => navigator.serviceWorker.removeEventListener("message", ouvir);
  }, [ativo, navigate]);
}
