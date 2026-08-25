/**
 * "Leva a câmera até o elemento e pisca duas vezes."
 *
 * Padrão único do sistema para não perder de vista uma coisa que acabou de
 * aparecer (bloco/item recém-criado) ou que o usuário pediu para achar (a
 * próxima pendência). Em tela longa — uma EC com dezenas de itens, um cronograma
 * com vários blocos — o item novo nascia fora do campo de visão e a pessoa
 * precisava caçá-lo na rolagem.
 *
 * Duas variantes, com significados diferentes:
 *  · `novo`      — laranja da marca, para algo que acabou de ser criado;
 *  · `pendencia` — vermelho, para algo que exige ação.
 */
export type VarianteDestaque = "novo" | "pendencia";

const CLASSE: Record<VarianteDestaque, string> = {
  novo: "destaque-novo",
  pendencia: "destaque-pendencia",
};

/** Duas repetições de 1,1s (ver index.css) + folga para a rolagem terminar. */
const DURACAO_MS = 2600;

/**
 * Quantas vezes reesperar o React pintar o elemento recém-criado, e o intervalo
 * entre as tentativas (~1 quadro). Usamos `setTimeout` e não
 * `requestAnimationFrame`: rAF fica suspenso quando a aba não está compondo
 * quadros, e aí o destaque simplesmente nunca acontecia.
 */
const MAX_TENTATIVAS = 12;
const INTERVALO_MS = 16;

const semAnimacao = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Rola até o elemento de `id` e o faz latejar. Pode ser chamado no mesmo
 * clique que cria o elemento: se ele ainda não existe no DOM, tenta de novo
 * nos próximos quadros até o React terminar de renderizar.
 */
export function destacarElemento(id: string, variante: VarianteDestaque = "novo"): void {
  const classe = CLASSE[variante];
  comElemento(id, (el) => {
    el.scrollIntoView({ behavior: semAnimacao() ? "auto" : "smooth", block: "center" });
    // Remover e forçar reflow reinicia a animação mesmo quando é o mesmo
    // elemento destacado duas vezes seguidas.
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    window.setTimeout(() => el.classList.remove(classe), DURACAO_MS);
  });
}

/**
 * Faz a tela acompanhar um elemento que acabou de se mover, mantendo-o SEMPRE no
 * centro — a pessoa aperta a seta várias vezes seguidas e o item nunca escapa do
 * campo de visão. Diferente de `destacarElemento`, não pisca: aqui o objetivo é
 * só a câmera seguir, sem chamar atenção a cada passo.
 */
export function seguirElemento(id: string): void {
  comElemento(id, (el) => {
    el.scrollIntoView({ behavior: semAnimacao() ? "auto" : "smooth", block: "center" });
  });
}

/**
 * Executa `acao` assim que o elemento existir no DOM. Pode ser chamado no mesmo
 * clique que cria ou move o elemento: se ainda não foi pintado pelo React, tenta
 * de novo por alguns instantes.
 */
function comElemento(id: string, acao: (el: HTMLElement) => void): void {
  if (typeof document === "undefined") return;
  let tentativas = 0;
  const tentar = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (tentativas++ < MAX_TENTATIVAS) window.setTimeout(tentar, INTERVALO_MS);
      return;
    }
    acao(el);
  };
  // Adiado um passo: no clique que cria o elemento, o React ainda não pintou.
  window.setTimeout(tentar, 0);
}

/* --------- ids de elemento usados pelo destaque (um por tipo) --------- */

/** Ids podem conter ":" (ex.: "extra:uuid"); trocamos para não quebrar seletores. */
const limpar = (id: string) => id.replace(/[^\w-]/g, "-");

/**
 * Âncora de uma pendência: o elemento que o navegador procura no DOM para rolar
 * até ela. Vale para a linha da EC, o item do check-list e a OS — o contrato com
 * quem renderiza é só esse `id`.
 */
export const idAncoraPendencia = (id: string) => `pendencia-${limpar(id)}`;

/** Âncora de uma observação dentro da thread — o comentário exato que pisca. */
export const idComentario = (id: string) => `comentario-${limpar(id)}`;

export const idBlocoCronograma = (id: string) => `bloco-cronograma-${limpar(id)}`;
export const idFaixaCronograma = (id: string) => `faixa-cronograma-${limpar(id)}`;
export const idGrupoEc = (id: string) => `grupo-ec-${limpar(id)}`;
export const idBlocoRoteiro = (id: string) => `bloco-roteiro-${limpar(id)}`;
