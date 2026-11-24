/**
 * ESC fecha o modal — e fecha só o de cima.
 *
 * Nenhum dos ~40 modais do app fechava com ESC: quem abria um formulário sem querer só saía
 * dele achando o "×" com o mouse, e quem usa leitor de tela não tinha saída anunciada nenhuma.
 *
 * O ponto delicado é o modal dentro do modal — o detalhe do holerite abre o editor de rubrica,
 * a lista de colaboradores abre a confirmação de exclusão. Um `keydown` por modal, todos no
 * `document`, fecharia os dois de uma vez: os dois ouvintes disparam no mesmo nó, e
 * `stopPropagation` não impede o irmão. Por isso a pilha: cada modal aberto se empilha, o ESC
 * chama só o último, e o de baixo continua aberto.
 *
 * A pilha vive fora do React de propósito — é estado do documento, não de um componente, e é o
 * que permite testá-la sem DOM.
 */
import { useEffect, useRef } from "react";

type ModalAberto = { fechar: () => void };

const pilha: ModalAberto[] = [];

/** Empilha um modal aberto. Devolve a função que o desempilha. */
export function empilharModal(modal: ModalAberto): () => void {
  pilha.push(modal);
  return () => {
    // `lastIndexOf` e não `indexOf`: dois modais podem compartilhar o mesmo objeto de
    // fechamento, e quem sai é o mais recente.
    const posicao = pilha.lastIndexOf(modal);
    if (posicao >= 0) pilha.splice(posicao, 1);
  };
}

/** Fecha o modal do topo, se houver algum. Devolve se fechou. */
export function fecharModalDoTopo(): boolean {
  const topo = pilha[pilha.length - 1];
  if (!topo) return false;
  topo.fechar();
  return true;
}

/** Quantos modais estão abertos. Existe para o teste enxergar a pilha. */
export const modaisAbertos = (): number => pilha.length;

let ouvindo = false;

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key !== "Escape" || evento.defaultPrevented) return;
  if (fecharModalDoTopo()) evento.preventDefault();
}

/**
 * Registra o modal enquanto ele estiver aberto e fecha-o no ESC.
 *
 * `aberto` existe porque metade dos modais do app é montada o tempo todo e some por
 * `if (!aberto) return null` — esse `return` acontece DEPOIS dos hooks, então o hook precisa
 * saber que o modal não está na tela em vez de deixar de ser chamado.
 */
export function useFecharComEsc(aoFechar: (() => void) | undefined, aberto = true) {
  const guardado = useRef(aoFechar);
  useEffect(() => { guardado.current = aoFechar; });

  const ativo = aberto && Boolean(aoFechar);
  useEffect(() => {
    if (!ativo) return;
    const desempilhar = empilharModal({ fechar: () => guardado.current?.() });
    if (!ouvindo) {
      document.addEventListener("keydown", aoTeclar);
      ouvindo = true;
    }
    return () => {
      desempilhar();
      if (modaisAbertos() === 0 && ouvindo) {
        document.removeEventListener("keydown", aoTeclar);
        ouvindo = false;
      }
    };
  }, [ativo]);
}
