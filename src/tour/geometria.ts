/**
 * Onde desenhar o balão do tour — a conta que decide se ele fica em cima do
 * lugar certo ou flutuando torto no meio da tela.
 *
 * Está separado da tela de propósito: é a única parte do tour que pode errar em
 * silêncio. Um balão fora da janela, uma seta apontando para o nada ou um
 * retângulo deslocado do botão não quebram nada — o app continua funcionando —
 * e por isso passariam despercebidos até alguém abrir o tour e não entender o
 * que está sendo mostrado. Aqui a conta é pura, e os testes cobrem inclusive as
 * posições absurdas (alvo colado na borda, alvo maior que a tela, alvo fora da
 * janela).
 *
 * Três garantias que os testes cravam:
 *   1. o balão NUNCA sai da janela — em nenhuma combinação;
 *   2. a seta só existe quando de fato aponta para o alvo;
 *   3. o lado escolhido é o primeiro que CABE inteiro, na ordem de preferência.
 */

export interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** De que lado do alvo o balão fica. `centro` = sem alvo, no meio da tela. */
export type Lado = "baixo" | "cima" | "direita" | "esquerda" | "centro";

export interface PosicaoBalao {
  top: number;
  left: number;
  lado: Lado;
  /**
   * Onde encostar a seta, em pixels a partir do canto do balão (horizontal nos
   * lados cima/baixo, vertical nos lados esquerda/direita). `null` quando o
   * alvo não está na frente do balão — seta apontando para o nada é pior do
   * que seta nenhuma.
   */
  seta: number | null;
}

interface Entrada {
  alvo: Retangulo | null;
  balao: { largura: number; altura: number };
  janela: { largura: number; altura: number };
  /** Lado tentado primeiro; os outros entram na ordem padrão depois dele. */
  preferida?: Lado;
  /** Respiro entre o alvo e o balão. */
  margem?: number;
  /** Respiro mínimo entre o balão e a borda da janela. */
  borda?: number;
}

const ORDEM: Lado[] = ["baixo", "cima", "direita", "esquerda"];

/** A seta não encosta no canto arredondado do balão. */
const RECUO_SETA = 20;

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function posicionarBalao({
  alvo,
  balao,
  janela,
  preferida,
  margem = 14,
  borda = 12,
}: Entrada): PosicaoBalao {
  // Sem alvo (passo de abertura, ou elemento que não existe nesta tela): centro.
  if (!alvo) {
    return {
      top: Math.max(borda, (janela.altura - balao.altura) / 2),
      left: Math.max(borda, (janela.largura - balao.largura) / 2),
      lado: "centro",
      seta: null,
    };
  }

  const candidatos = [preferida, ...ORDEM].filter(
    (l, i, arr): l is Lado => !!l && l !== "centro" && arr.indexOf(l) === i
  );

  let escolhido: { lado: Lado; top: number; left: number } | null = null;
  let melhorFolga = -Infinity;
  let reserva: { lado: Lado; top: number; left: number } | null = null;

  for (const lado of candidatos) {
    const p = bruto(lado, alvo, balao, margem);
    if (cabe(p, balao, janela, borda)) {
      escolhido = { lado, ...p };
      break;
    }
    // Guarda o menos ruim: o lado com mais espaço livre do lado de fora do alvo.
    const folga = espacoDisponivel(lado, alvo, janela);
    if (folga > melhorFolga) {
      melhorFolga = folga;
      reserva = { lado, ...p };
    }
  }

  const base = escolhido ?? reserva!;
  // Mesmo o lado escolhido é limitado: alvo colado na borda empurraria o balão
  // para fora no outro eixo (um botão no canto direito, por exemplo).
  const top = limitar(base.top, borda, Math.max(borda, janela.altura - balao.altura - borda));
  const left = limitar(base.left, borda, Math.max(borda, janela.largura - balao.largura - borda));

  return { top, left, lado: base.lado, seta: posicaoDaSeta(base.lado, alvo, { top, left }, balao) };
}

/** Posição ideal, antes de qualquer limite de janela. */
function bruto(lado: Lado, alvo: Retangulo, balao: Entrada["balao"], margem: number) {
  const centroX = alvo.left + alvo.width / 2 - balao.largura / 2;
  const centroY = alvo.top + alvo.height / 2 - balao.altura / 2;
  switch (lado) {
    case "baixo":
      return { top: alvo.top + alvo.height + margem, left: centroX };
    case "cima":
      return { top: alvo.top - balao.altura - margem, left: centroX };
    case "direita":
      return { top: centroY, left: alvo.left + alvo.width + margem };
    default:
      return { top: centroY, left: alvo.left - balao.largura - margem };
  }
}

function cabe(
  p: { top: number; left: number },
  balao: Entrada["balao"],
  janela: Entrada["janela"],
  borda: number
): boolean {
  return (
    p.top >= borda &&
    p.left >= borda &&
    p.top + balao.altura <= janela.altura - borda &&
    p.left + balao.largura <= janela.largura - borda
  );
}

/** Quanto sobra daquele lado do alvo até a borda da janela. */
function espacoDisponivel(lado: Lado, alvo: Retangulo, janela: Entrada["janela"]): number {
  switch (lado) {
    case "baixo":
      return janela.altura - (alvo.top + alvo.height);
    case "cima":
      return alvo.top;
    case "direita":
      return janela.largura - (alvo.left + alvo.width);
    default:
      return alvo.left;
  }
}

/**
 * A seta aponta para o CENTRO do alvo — e só existe se esse centro estiver
 * dentro da aresta do balão. Alvo largo demais, alvo empurrado para o canto:
 * nesses casos a seta sairia da caixa ou apontaria para o lado errado, e é
 * melhor não desenhar nada.
 */
function posicaoDaSeta(
  lado: Lado,
  alvo: Retangulo,
  pos: { top: number; left: number },
  balao: Entrada["balao"]
): number | null {
  const horizontal = lado === "baixo" || lado === "cima";
  const centro = horizontal ? alvo.left + alvo.width / 2 : alvo.top + alvo.height / 2;
  const inicio = horizontal ? pos.left : pos.top;
  const tamanho = horizontal ? balao.largura : balao.altura;
  const relativo = centro - inicio;
  if (relativo < RECUO_SETA / 2 || relativo > tamanho - RECUO_SETA / 2) return null;
  return limitar(relativo, RECUO_SETA, tamanho - RECUO_SETA);
}

/**
 * Até onde rolar a página para o alvo aparecer INTEIRO abaixo das camadas
 * grudadas (barra de navegação + cabeçalho da tela).
 *
 * Devolve `null` quando o alvo já está visível: rolar do mesmo jeito faria a
 * tela dar um pulo a cada passo do tour, inclusive nos passos que apontam para
 * a própria barra de cima — que nunca sai da tela.
 */
export function rolagemNecessaria(
  alvo: Retangulo,
  janela: { altura: number },
  camadas: number,
  scrollAtual: number,
  respiro = 24
): number | null {
  const topoUtil = camadas + respiro;
  const baseUtil = janela.altura - respiro;
  const jaVisivel = alvo.top >= topoUtil && alvo.top + alvo.height <= baseUtil;
  if (jaVisivel) return null;
  // Sempre alinha o COMEÇO do alvo logo abaixo das camadas — inclusive quando
  // ele é mais alto que a tela, que é justamente quando centralizar cortaria a
  // parte de cima, que é por onde se lê.
  return Math.max(0, Math.round(scrollAtual + alvo.top - topoUtil));
}
