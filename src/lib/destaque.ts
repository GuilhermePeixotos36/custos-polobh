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
 * Relógio de cada elemento que está piscando agora.
 *
 * Sem isto, destacar o MESMO elemento duas vezes seguidas (duas pendências no
 * mesmo item, seta apertada de novo) reiniciava a animação mas deixava vivo o
 * timer da primeira — que apagava a classe no meio do segundo pisca. O resultado
 * era um pisca pela metade, ou nenhum. Guardar o timer permite cancelá-lo.
 */
const relogios = new WeakMap<HTMLElement, number>();

/**
 * Rola até o elemento de `id` e o faz latejar. Pode ser chamado no mesmo
 * clique que cria o elemento: se ele ainda não existe no DOM, tenta de novo
 * nos próximos quadros até o React terminar de renderizar.
 */
export function destacarElemento(
  id: string,
  variante: VarianteDestaque = "novo",
  opcoes: { rolar?: boolean } = {}
): void {
  const classe = CLASSE[variante];
  comElemento(id, (el) => {
    // `rolar: false` para destacar VÁRIOS elementos de uma vez: só o primeiro
    // leva a câmera; os outros piscam onde estão, sem as rolagens brigarem.
    if (opcoes.rolar !== false) el.scrollIntoView({ behavior: semAnimacao() ? "auto" : "smooth", block: "center" });
    // Remover e forçar reflow reinicia a animação mesmo quando é o mesmo
    // elemento destacado duas vezes seguidas. O timer anterior é cancelado junto,
    // senão ele apagaria a classe no meio deste novo pisca.
    const anterior = relogios.get(el);
    if (anterior) window.clearTimeout(anterior);
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    relogios.set(
      el,
      window.setTimeout(() => {
        el.classList.remove(classe);
        relogios.delete(el);
      }, DURACAO_MS)
    );
  });
}

/**
 * Leva a pessoa ao CAMPO que travou uma ação, e deixa o cursor nele.
 *
 * Um aviso dizendo "falta a justificativa do BV" não resolve nada numa tela de
 * quinze blocos: a pessoa lê o aviso e ainda tem de caçar o campo na rolagem —
 * o mesmo problema que a pílula de pendências resolve no resto do sistema.
 * Aqui o aviso e o campo passam a ser a mesma coisa: a tela rola até ele, ele
 * pisca em vermelho e já recebe o cursor.
 *
 * O foco vai com `preventScroll`: sem isso o navegador daria o seu próprio
 * pulo até o campo, atropelando a rolagem suave que acabou de começar.
 */
export function destacarCampo(id: string): void {
  destacarElemento(id, "pendencia", { rolar: true });
  comElemento(id, (el) => {
    const alvo = el.matches(SELETOR_FOCAVEL)
      ? el
      : el.querySelector<HTMLElement>(SELETOR_FOCAVEL);
    alvo?.focus({ preventScroll: true });
  });
}

/** O que conta como "o campo" dentro do bloco destacado. */
const SELETOR_FOCAVEL = "input, textarea, select, [contenteditable=true]";

/**
 * As DUAS marcas permanentes da pendência (15/09/2026).
 *
 * Até aqui, achar uma pendência era um pisca de 2,6 segundos: a pessoa desviava
 * o olho, ele acabava, e ela perdia o lugar — "hoje a pendência pisca quando
 * acionada; ela pode ficar vermelha enquanto estiver pendente?", pediu a Pólobh,
 * quatro vezes no mesmo check-list.
 *
 * São duas coisas diferentes, e por isso duas classes:
 *  · `com-pendencia` — o contorno discreto de TUDO que tem pendência aberta.
 *    Não pede ação agora; diz "aqui tem algo a resolver", e só some quando a
 *    pendência some;
 *  · `pendencia-atual` — o realce forte do item que a pílula está apontando
 *    NESTE momento. Sai quando a seta leva para o próximo.
 *
 * O pisca continua existindo, e agora no papel certo: é o aceno de "a seta fez
 * alguma coisa" quando a câmera não precisa se mexer, por cima da marca que
 * fica.
 */
export const CLASSE_COM_PENDENCIA = "com-pendencia";
export const CLASSE_PENDENCIA_ATUAL = "pendencia-atual";

/**
 * Marca no DOM os elementos que têm pendência aberta, e desmarca o resto.
 *
 * Trabalha por varredura em vez de prop a prop de propósito: as âncoras já
 * existem (`idAncoraPendencia`), estão espalhadas por dez telas, e passar um
 * booleano por cada linha de cada lista significaria mexer em todas elas —
 * com o risco de uma esquecer e ficar sem a marca, que é justamente o defeito
 * que se está corrigindo.
 */
export function marcarPendencias(ancoras: string[]): void {
  if (typeof document === "undefined") return;
  const querDestaque = new Set(ancoras.map((a) => idAncoraPendencia(a)));
  for (const el of document.querySelectorAll<HTMLElement>(`.${CLASSE_COM_PENDENCIA}`)) {
    if (!querDestaque.has(el.id)) el.classList.remove(CLASSE_COM_PENDENCIA);
  }
  for (const id of querDestaque) {
    document.getElementById(id)?.classList.add(CLASSE_COM_PENDENCIA);
  }
}

/** Tira a marca de todos — usado quando a tela que as contava sai de cena. */
export function limparMarcasDePendencia(): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll<HTMLElement>(`.${CLASSE_COM_PENDENCIA}, .${CLASSE_PENDENCIA_ATUAL}`)) {
    el.classList.remove(CLASSE_COM_PENDENCIA, CLASSE_PENDENCIA_ATUAL);
  }
}

/**
 * O realce forte da pendência que a pílula aponta agora. Uma por vez: marcar a
 * nova apaga a anterior, sem que o chamador precise guardar qual era.
 */
export function marcarPendenciaAtual(ancora: string | null): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll<HTMLElement>(`.${CLASSE_PENDENCIA_ATUAL}`)) {
    el.classList.remove(CLASSE_PENDENCIA_ATUAL);
  }
  if (!ancora) return;
  // Pode ser chamado no mesmo quadro em que a tela ainda está pintando.
  comElemento(idAncoraPendencia(ancora), (el) => el.classList.add(CLASSE_PENDENCIA_ATUAL));
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

/**
 * Campo de status dentro do item (OS / Contrato) — quando a pendência não é um
 * comentário e sim "esta OS precisa ser emitida", é este pedaço da tela que
 * pisca, e não a linha inteira.
 */
export const idCampoPendencia = (ancora: string, campo: string) => `pendencia-campo-${limpar(ancora)}-${campo}`;

/**
 * Âncora de um campo que TRAVA uma ação (salvar, disparar). É o que o aviso
 * usa para levar a pessoa até lá — ver `destacarCampo`.
 */
export const idCampoTrava = (campo: string) => `trava-${limpar(campo)}`;

/** Campo "Descrição Completa" do item — onde o resumo da proposta é inserido. */
export const idCampoDescricaoCompleta = (id: string) => `descricao-completa-${limpar(id)}`;

export const idBlocoCronograma = (id: string) => `bloco-cronograma-${limpar(id)}`;
export const idFaixaCronograma = (id: string) => `faixa-cronograma-${limpar(id)}`;
export const idGrupoEc = (id: string) => `grupo-ec-${limpar(id)}`;
export const idBlocoRoteiro = (id: string) => `bloco-roteiro-${limpar(id)}`;
