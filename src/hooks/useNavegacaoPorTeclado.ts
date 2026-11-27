/**
 * PREENCHER PELO TECLADO (27/11/2026) — nada visual, só o formulário andando
 * sem o mouse:
 *
 *   · TAB num campo de texto ou de valor já SELECIONA o que está nele: digitar
 *     substitui, em vez de emendar no que havia;
 *   · numa LISTA (select), SETA PARA BAIXO — ou Ctrl+seta — ABRE as opções, em
 *     vez de trocar o valor às cegas; as setas escolhem, Enter confirma e Tab
 *     segue para o próximo campo;
 *   · chegar pelo Tab a um BLOCO RECOLHIDO (os blocos da OS, os grupos da EC)
 *     abre o bloco, e sair dele pelo Tab o recolhe de novo — ver `useAbreNoTab`.
 *
 * É um ouvinte só, ligado no layout do app: vale para todas as telas, sem cada
 * campo precisar saber disso.
 */
import { useCallback, useEffect, useRef, type FocusEvent } from "react";

/** Quando foi o último Tab — é o que diz se o foco chegou pelo teclado. */
let ultimoTab = 0;
const JANELA_MS = 400;

/** O foco que acabou de acontecer veio do Tab (e não de um clique ou de código)? */
export const focoVeioDoTab = (): boolean => Date.now() - ultimoTab < JANELA_MS;

/** Tipos de `<input>` em que selecionar o conteúdo faz sentido. */
const TIPOS_DE_TEXTO = new Set(["text", "search", "tel", "url", "email", "number", "password", ""]);

/** A lista que este mecanismo abriu e ainda não foi fechada. */
let listaAberta: HTMLSelectElement | null = null;

export function useNavegacaoPorTeclado(): void {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Tab") ultimoTab = Date.now();

      const alvo = e.target;
      if (!(alvo instanceof HTMLSelectElement) || alvo.disabled || alvo.multiple) return;

      // Enter, Esc e Tab encerram a lista (o navegador faz o resto).
      if (e.key === "Enter" || e.key === "Escape" || e.key === "Tab") {
        listaAberta = null;
        return;
      }
      // Seta para baixo (com ou sem Ctrl) ABRE a lista. Alt+seta já é o atalho
      // do próprio navegador; com a lista aberta, as setas são dela.
      if (e.key !== "ArrowDown" || e.altKey || e.metaKey || e.shiftKey) return;
      if (listaAberta === alvo) return;
      if (typeof alvo.showPicker !== "function") return; // navegador antigo: fica o comportamento nativo
      try {
        alvo.showPicker();
        listaAberta = alvo;
        e.preventDefault();
      } catch {
        // O navegador recusou abrir (sem gesto do usuário, por exemplo): segue o nativo.
      }
    };

    const aoFocar = (e: FocusEvent | globalThis.FocusEvent) => {
      const alvo = e.target;
      if (!focoVeioDoTab()) return;
      if (!(alvo instanceof HTMLInputElement) || alvo.readOnly || alvo.disabled) return;
      if (!TIPOS_DE_TEXTO.has((alvo.getAttribute("type") ?? "").toLowerCase())) return;
      // Depois do foco: alguns campos (os de moeda) reescrevem o valor ao receber o foco.
      requestAnimationFrame(() => {
        if (document.activeElement === alvo) {
          try {
            alvo.select();
          } catch {
            // Tipos que não aceitam seleção (alguns navegadores, em "number"/"email").
          }
        }
      });
    };

    /** Escolheu, saiu ou clicou: a lista não está mais aberta. */
    const fechar = () => {
      listaAberta = null;
    };

    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("focusin", aoFocar as EventListener);
    document.addEventListener("change", fechar, true);
    document.addEventListener("focusout", fechar, true);
    document.addEventListener("mousedown", fechar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("focusin", aoFocar as EventListener);
      document.removeEventListener("change", fechar, true);
      document.removeEventListener("focusout", fechar, true);
      document.removeEventListener("mousedown", fechar, true);
    };
  }, []);
}

/**
 * O BLOCO QUE ABRE NO TAB. Para um bloco recolhível (cabeçalho + conteúdo):
 *
 *   · `aoFocarCabecalho` vai no elemento do cabeçalho que recebe o foco — se o
 *     foco chegou pelo Tab e o bloco está fechado, ele abre;
 *   · `aoSairDoBloco` vai no elemento que envolve o bloco inteiro — quando o
 *     foco sai dele pelo Tab, o bloco que este mecanismo abriu volta a fechar.
 *
 * Bloco que a pessoa abriu com o mouse (ou com Enter) NÃO é fechado sozinho:
 * só o que o Tab abriu é do Tab para fechar.
 */
export function useAbreNoTab(aberto: boolean, alternar: () => void) {
  const abertoPeloTab = useRef(false);
  // O estado mais recente, para os dois ouvintes não fecharem com um valor velho.
  const estado = useRef({ aberto, alternar });
  estado.current = { aberto, alternar };

  const aoFocarCabecalho = useCallback(() => {
    if (!focoVeioDoTab() || estado.current.aberto) return;
    abertoPeloTab.current = true;
    estado.current.alternar();
  }, []);

  const aoSairDoBloco = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!abertoPeloTab.current) return;
    const destino = e.relatedTarget;
    // Sem destino (a janela perdeu o foco) ou ainda dentro do bloco: nada muda.
    if (!(destino instanceof Node) || e.currentTarget.contains(destino)) return;
    if (!focoVeioDoTab()) {
      // Saiu com o mouse: o bloco fica como está, e passa a ser de quem clicou.
      abertoPeloTab.current = false;
      return;
    }
    abertoPeloTab.current = false;
    if (estado.current.aberto) estado.current.alternar();
  }, []);

  return { aoFocarCabecalho, aoSairDoBloco };
}
