/**
 * Acha o elemento do passo e mantém o retângulo dele SEMPRE atualizado.
 *
 * É aqui que mora o risco de "o foco ficou deslocado". Um tour ingênuo mede o
 * elemento uma vez e desenha; aí a tela rola, uma imagem carrega, um dado chega
 * e empurra o botão dois centímetros — e o buraco iluminado fica apontando para
 * o lugar onde o botão estava. O contrário também acontece: medir cedo demais,
 * antes de o React pintar a tela nova, e desenhar um retângulo de tamanho zero
 * no canto superior esquerdo.
 *
 * A saída é medir A CADA QUADRO enquanto o passo está aberto. Custa uma
 * `getBoundingClientRect` por quadro — microssegundos — e resolve de uma vez
 * rolagem, animação, carregamento tardio e mudança de tamanho da janela. O
 * estado só é atualizado quando o retângulo muda de verdade, então a tela não
 * redesenha à toa.
 *
 * O elemento pode simplesmente não existir (tela sem permissão, lista vazia).
 * Depois de um tempo de espera o passo desiste e devolve `null` — e o balão vai
 * para o centro com a explicação, em vez de apontar para o vazio.
 */
import { useEffect, useRef, useState } from "react";
import { rolagemNecessaria, type Retangulo } from "./geometria";

/** Quanto esperar o elemento aparecer antes de desistir dele. */
const ESPERA_MS = 4000;

/** Diferença abaixo disto é ruído de subpixel, não movimento. */
const RUIDO = 0.5;

const igual = (a: Retangulo | null, b: Retangulo): boolean =>
  !!a &&
  Math.abs(a.top - b.top) < RUIDO &&
  Math.abs(a.left - b.left) < RUIDO &&
  Math.abs(a.width - b.width) < RUIDO &&
  Math.abs(a.height - b.height) < RUIDO;

/** Altura das camadas grudadas (barra de cima + cabeçalho da tela). */
function alturaDasCamadas(): number {
  const estilo = getComputedStyle(document.documentElement);
  const px = (nome: string) => parseFloat(estilo.getPropertyValue(nome)) || 0;
  return px("--altura-topnav") + px("--altura-cabecalho");
}

export interface AlvoDoPasso {
  /** Retângulo do elemento em coordenadas da JANELA (é o que o overlay usa). */
  rect: Retangulo | null;
  /** Ainda procurando: a tela do passo pode estar carregando. */
  procurando: boolean;
}

export function useAlvo(seletor: string | undefined, chave: string, ativo: boolean): AlvoDoPasso {
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [procurando, setProcurando] = useState(false);
  // O retângulo vivo fica no ref: o laço lê e compara sem depender do estado,
  // que só é tocado quando muda de verdade.
  const atual = useRef<Retangulo | null>(null);

  useEffect(() => {
    atual.current = null;
    setRect(null);
    if (!ativo || !seletor) {
      setProcurando(false);
      return;
    }
    setProcurando(true);

    let vivo = true;
    let quadro = 0;
    let jaRolou = false;
    const inicio = performance.now();

    const medir = () => {
      if (!vivo) return;
      const el = document.querySelector<HTMLElement>(seletor);
      const r = el?.getBoundingClientRect();

      // Elemento existe e tem tamanho. `display:contents` e elemento ainda não
      // pintado devolvem caixa zerada — que desenharia um ponto no canto.
      if (r && (r.width > 0 || r.height > 0)) {
        if (!jaRolou) {
          jaRolou = true;
          rolarAte(el!);
        }
        const novo = { top: r.top, left: r.left, width: r.width, height: r.height };
        if (!igual(atual.current, novo)) {
          atual.current = novo;
          setRect(novo);
        }
        setProcurando(false);
      } else if (!atual.current && performance.now() - inicio > ESPERA_MS) {
        // Desistiu: o passo continua, sem alvo.
        setProcurando(false);
      }

      quadro = requestAnimationFrame(medir);
    };

    quadro = requestAnimationFrame(medir);
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
    };
  }, [seletor, chave, ativo]);

  return { rect, procurando };
}

/**
 * Traz o alvo para a área visível, respeitando as camadas grudadas.
 *
 * São dois movimentos, e os dois são necessários: o primeiro resolve elemento
 * dentro de uma lista que rola por dentro (o `scrollIntoView` percorre os
 * ancestrais roláveis); o segundo tira o elemento de debaixo do cabeçalho, que
 * é o caso que o navegador não conhece — para ele, coberto é o mesmo que
 * visível.
 */
function rolarAte(el: HTMLElement): void {
  const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  const r = el.getBoundingClientRect();
  const destino = rolagemNecessaria(
    { top: r.top, left: r.left, width: r.width, height: r.height },
    { altura: window.innerHeight },
    alturaDasCamadas(),
    window.scrollY
  );
  if (destino !== null) window.scrollTo({ top: destino, behavior: suave ? "smooth" : "auto" });
}
