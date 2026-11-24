/**
 * Manter montado o que está saindo — o que dá saída animada a modal, popover e aviso.
 *
 * O React desmonta no mesmo quadro em que a tela decide fechar; para a animação de saída rodar,
 * alguém precisa segurar o elemento na árvore mais um instante e depois soltá-lo. É o que este
 * gancho faz: `montado` diz se renderiza, `saindo` diz se aplica a classe de saída (`saida-*`, em
 * `styles.css`).
 */
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Duração de toda saída do app. Casa com `--duracao-rapida` (120ms) do `styles.css`: se um mudar
 * sem o outro, ou a animação é cortada no meio (desmonta antes) ou o elemento fica parado,
 * invisível e sem clique, esperando o relógio.
 */
export const DURACAO_SAIDA_MS = 120;

const CONSULTA = "(prefers-reduced-motion: reduce)";

function assinar(aviso: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const midia = window.matchMedia(CONSULTA);
  midia.addEventListener("change", aviso);
  return () => midia.removeEventListener("change", aviso);
}

function ler(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia) && window.matchMedia(CONSULTA).matches;
}

/**
 * `true` quando o sistema pede menos movimento.
 *
 * O CSS já zera as animações sozinho nesse caso; isto existe para o que é temporizado em JS. Sem
 * ele, o modal com movimento reduzido fecharia sem animação nenhuma e ainda assim ficaria 120ms
 * na tela, parado — o pior dos dois mundos.
 */
export function usePrefereMenosMovimento(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}

/**
 * Segura o elemento montado enquanto a saída roda.
 *
 * Reabrir no meio da saída cancela a desmontagem: `saindo` volta a `false` e a classe de entrada
 * reaparece, sem piscar vazio.
 */
export function usePresenca(visivel: boolean, duracaoSaidaMs = DURACAO_SAIDA_MS): { montado: boolean; saindo: boolean } {
  const menos = usePrefereMenosMovimento();
  const [montado, setMontado] = useState(visivel);
  // Ajuste durante o render (estado derivado de prop): abrir monta na hora, sem esperar um efeito
  // e pintar um quadro sem o painel.
  if (visivel && !montado) setMontado(true);

  useEffect(() => {
    if (visivel || !montado) return;
    if (menos || duracaoSaidaMs <= 0) {
      setMontado(false);
      return;
    }
    const relogio = window.setTimeout(() => setMontado(false), duracaoSaidaMs);
    return () => window.clearTimeout(relogio);
  }, [visivel, montado, menos, duracaoSaidaMs]);

  return { montado: visivel || montado, saindo: !visivel && montado };
}
