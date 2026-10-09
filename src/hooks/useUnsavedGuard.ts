/**
 * Avisa antes de sair de um formulário com alterações não salvas.
 * - Navegação interna (links/botões): intercepta com useBlocker + dialog.
 * - Recarregar/fechar a aba: beforeunload nativo.
 *
 * `liberar()` desativa o guarda para a navegação programática feita logo após
 * salvar (senão o próprio "salvar e ir para o detalhe" seria bloqueado).
 */
import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { confirmar } from "@/store/confirm";
import { tourNavegando } from "@/tour/store";

/**
 * Vários formulários sujos podem estar abertos ao mesmo tempo (a EC e um
 * comentário em escrita, por exemplo), e cada um tem o seu guarda. A pergunta,
 * porém, é uma só: enquanto ela está na tela, os outros guardas esperam a MESMA
 * resposta — sem isso, sair da tela fazia o diálogo aparecer uma vez por guarda.
 */
let perguntaAberta: Promise<boolean> | null = null;
function perguntarSeSai(): Promise<boolean> {
  if (!perguntaAberta) {
    perguntaAberta = confirmar({
      titulo: "Sair sem salvar?",
      mensagem: "Há alterações não salvas neste formulário. Se sair agora, elas serão perdidas.",
      confirmarTexto: "Sair sem salvar",
      cancelarTexto: "Continuar editando",
      tom: "danger",
    }).finally(() => {
      perguntaAberta = null;
    });
  }
  return perguntaAberta;
}

export function useUnsavedGuard(sujo: boolean) {
  const bypass = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo &&
      !bypass.current &&
      // O tour guiado passa por formulários que nascem "mexidos" (uma EC nova
      // já vem com os itens do modelo). Sem esta saída, cada passo do tour
      // esbarraria num "Sair sem salvar?" por cima da sobreposição — e não há
      // trabalho de verdade para proteger: o tour não digita nada.
      !tourNavegando() &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let ativo = true;
    perguntarSeSai().then((ok) => {
      if (!ativo) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      ativo = false;
    };
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Depois de salvar o formulário volta a "limpo": rearma a trava para a próxima
  // edição (senão o `liberar` do salvamento valeria para sempre).
  useEffect(() => {
    if (!sujo) bypass.current = false;
  }, [sujo]);

  useEffect(() => {
    if (!sujo) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sujo]);

  return { liberar: () => (bypass.current = true) };
}
