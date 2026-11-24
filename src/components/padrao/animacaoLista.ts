/**
 * Movimento das listas em matriz — reordenar pelo cabeçalho e trocar de página.
 *
 * Por que não FLIP (cada linha deslizando da posição antiga para a nova), que é o que o pacote de
 * UI do grupo faz nas listas de cartões: na `lista-matriz` ele não se sustenta.
 * - As células são transparentes. Linha voando por cima de linha mostra dois textos sobrepostos
 *   durante o deslize inteiro — com cartão opaco isso não acontece, com tabela acontece sempre.
 * - `transform` no `<tr>` abre um contexto de empilhamento por linha. A célula da coluna presa
 *   (`sticky left-0 z-10`) passa a valer z-10 só DENTRO da própria linha: a linha que se move
 *   escorrega por baixo do nome congelado das vizinhas e por cima do resto delas.
 * - Reordenar volta a lista para a página 1 (o `chaveOrdem` entra no `resetKey`), e nas listas
 *   longas quase nenhuma linha da página nova estava na página antiga. Sobraria FLIP só para as
 *   poucas que sobreviveram; o resto apareceria seco do mesmo jeito.
 *
 * O que fica no lugar:
 * - reordenar: as linhas visíveis reaparecem em cascata de cima para baixo, SÓ com opacidade.
 *   O olho lê "a lista foi refeita a partir do topo", e opacidade não mexe em caixa, grade,
 *   cabeçalho preso nem coluna congelada.
 * - trocar de página: o corpo da tabela entra deslizando 6px do lado para onde se andou, com
 *   fade. O `transform` vai no `<tbody>` inteiro — as linhas andam juntas e não se cruzam, o
 *   `<thead>` preso fica de fora e a coluna congelada anda com a própria linha.
 *
 * Tudo por Web Animations e sem `fill` para a frente: terminada (ou cancelada) a animação, nada
 * fica retido no elemento. Um `transform` pendurado no `<tbody>` viraria o bloco de contenção de
 * todo `position: fixed` lá dentro — e há modal aberto de dentro de linha de tabela.
 */

/** O mesmo `--curva-saida` do `styles.css`: a Web Animations não lê variável CSS na curva. */
export const CURVA_SAIDA = "cubic-bezier(0.2, 0, 0, 1)";

/** Linhas que entram na cascata. Da 13ª em diante a lista já saiu da vista em quase toda tela. */
const LIMITE_CASCATA = 12;
/**
 * Soma dos atrasos da cascata. Com a duração rápida (120ms) por linha, a última termina em 200ms,
 * o teto de movimento do app (ver o bloco "Movimento" do `@theme`) — mais do que isso a pessoa já
 * está lendo a primeira linha e a cascata vira espera.
 */
const ATRASO_TOTAL_MS = 80;
const DESLOCAMENTO_PAGINA_PX = 6;

export function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Duração de um token do `styles.css` (`--duracao-media`, `--duracao-painel`), para a animação
 * feita em JS andar no mesmo ritmo das feitas em CSS. Sem o token (teste, SSR), o valor de reserva.
 */
export function duracaoDoToken(token: string, reserva: number): number {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") return reserva;
  const bruto = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const ms = bruto.endsWith("ms") ? parseFloat(bruto) : bruto.endsWith("s") ? parseFloat(bruto) * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : reserva;
}

function podeAnimar(el: Element | null | undefined): el is HTMLElement {
  return Boolean(el) && typeof (el as HTMLElement).animate === "function" && !prefereMenosMovimento();
}

/** O contêiner que rola a lista — é contra ele, e não contra a janela, que "visível" se mede. */
function areaVisivel(el: HTMLElement): { top: number; bottom: number } {
  let atual = el.parentElement;
  for (let nivel = 0; atual && nivel < 6; nivel += 1, atual = atual.parentElement) {
    const { overflowY } = getComputedStyle(atual);
    if (overflowY === "auto" || overflowY === "scroll") {
      const area = atual.getBoundingClientRect();
      return { top: area.top, bottom: area.bottom };
    }
  }
  return { top: 0, bottom: window.innerHeight };
}

/** Animações que este módulo pôs num elemento, para a próxima cancelar a anterior sem salto. */
const emCurso = new WeakMap<Element, Animation[]>();

function cancelarEm(el: Element) {
  for (const animacao of emCurso.get(el) ?? []) animacao.cancel();
  emCurso.delete(el);
}

function registrar(el: Element, animacao: Animation) {
  emCurso.set(el, [...(emCurso.get(el) ?? []), animacao]);
}

/**
 * Cascata de opacidade nas linhas visíveis de um `<tbody>`, depois de reordenar.
 *
 * Só as linhas na área visível entram: animar a linha 40, que ninguém está vendo, é custo sem
 * plateia. O atraso de cada uma encolhe quando há muitas, para a cascata inteira caber no mesmo
 * teto de tempo.
 */
export function revelarLinhasEmCascata(corpo: HTMLTableSectionElement | null | undefined) {
  if (!podeAnimar(corpo)) return;
  const area = areaVisivel(corpo);
  const linhas = Array.from(corpo.rows).filter((linha) => {
    const caixa = linha.getBoundingClientRect();
    return caixa.bottom >= area.top && caixa.top <= area.bottom;
  }).slice(0, LIMITE_CASCATA);
  if (linhas.length === 0) return;

  const duracao = duracaoDoToken("--duracao-rapida", 120);
  const passo = linhas.length > 1 ? ATRASO_TOTAL_MS / (linhas.length - 1) : 0;
  linhas.forEach((linha, indice) => {
    cancelarEm(linha);
    registrar(linha, linha.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      // `backwards`: invisível durante o próprio atraso (senão a linha pisca cheia antes de
      // entrar); terminada, nenhuma opacidade fica presa nela.
      { duration: duracao, delay: indice * passo, easing: CURVA_SAIDA, fill: "backwards" },
    ));
  });
}

/**
 * Entrada lateral do corpo da lista na troca de página: `1` avançou (entra pela direita), `-1`
 * voltou (entra pela esquerda).
 */
export function deslizarPagina(alvo: Element | null | undefined, direcao: 1 | -1) {
  if (!podeAnimar(alvo)) return;
  cancelarEm(alvo);
  registrar(alvo, alvo.animate(
    [
      { opacity: 0, transform: `translateX(${DESLOCAMENTO_PAGINA_PX * direcao}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: duracaoDoToken("--duracao-media", 160), easing: CURVA_SAIDA },
  ));
}
