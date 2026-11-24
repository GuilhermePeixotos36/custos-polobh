import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * O indicador que desliza até a opção escolhida de um grupo de filtros ou controle segmentado.
 *
 * Quem usa: `FilterPills` e `Segmentado`. As abas de pasta (`FolderTabs`) ficam de fora de
 * propósito — lá a aba ativa emenda no painel de baixo, e um indicador correndo por cima da
 * emenda desmancharia exatamente o que ela desenha.
 *
 * A posição sai de `offsetLeft/Top`, relativos ao grupo (que precisa ser `relative`): não muda
 * com a rolagem da página, e dá conta do grupo que quebra em duas linhas (`flex-wrap` dos filtros
 * em tela estreita), onde a pílula precisa descer, não só andar de lado.
 *
 * Desliza SÓ quando a escolha muda. Na primeira pintura e quando a largura muda sem troca de
 * escolha (a contagem do filtro passou de 9 para 10, a janela encolheu) ela pula direto para o
 * lugar: deslizar ali seria movimento sem ação nenhuma da pessoa por trás.
 */
export type Pilula = { x: number; y: number; largura: number; altura: number; animar: boolean };

export function usePilulaDeslizante<T extends string>(valor: T) {
  const grupo = useRef<HTMLDivElement>(null);
  const botoes = useRef(new Map<T, HTMLButtonElement>());
  const [pilula, setPilula] = useState<Pilula | null>(null);
  const valorMedido = useRef<T | null>(null);

  // Sem lista de dependências: a largura do botão muda com o rótulo e com a contagem, que chegam
  // por props de quem usa. A comparação no `setPilula` é o que impede o laço — posição igual
  // devolve o mesmo objeto e o React não pinta de novo.
  useLayoutEffect(() => {
    function medir(animar: boolean) {
      const botao = botoes.current.get(valor);
      // jsdom (e botão escondido) mede 0: sem pílula, o botão ativo pinta o próprio fundo.
      const nova = botao && botao.offsetWidth > 0
        ? { x: botao.offsetLeft, y: botao.offsetTop, largura: botao.offsetWidth, altura: botao.offsetHeight, animar }
        : null;
      setPilula((atual) => {
        if (!nova || !atual) return nova;
        const mesmaCaixa = atual.x === nova.x && atual.y === nova.y && atual.largura === nova.largura && atual.altura === nova.altura;
        return mesmaCaixa ? atual : nova;
      });
    }
    const trocouEscolha = valorMedido.current !== null && valorMedido.current !== valor;
    valorMedido.current = valor;
    medir(trocouEscolha);

    const el = grupo.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => medir(false));
    observador.observe(el);
    for (const botao of botoes.current.values()) observador.observe(botao);
    return () => observador.disconnect();
  });

  const refBotao = (opcao: T) => (botao: HTMLButtonElement | null) => {
    if (botao) botoes.current.set(opcao, botao);
    else botoes.current.delete(opcao);
  };

  const botao = (opcao: T) => botoes.current.get(opcao);

  return { grupo, refBotao, botao, pilula };
}

/**
 * Setas no grupo: ← → (e ↑ ↓) andam para a opção vizinha, dando a volta nas pontas; Home e End
 * vão às extremidades. A escolha acompanha o foco, como num grupo de rádio — é um filtro, e ver
 * a lista mudar enquanto se anda pelas opções é a resposta que se quer. O Tab continua passando
 * por cada botão: quem já navegava assim não perde nada.
 */
export function teclaNoGrupo<T extends string>(
  evento: KeyboardEvent<HTMLElement>,
  opcoes: readonly { value: T; disabled?: boolean }[],
  valor: T,
  escolher: (valor: T) => void,
  botoes: (valor: T) => HTMLButtonElement | undefined,
) {
  const habilitadas = opcoes.filter((opcao) => !opcao.disabled);
  if (habilitadas.length === 0) return;
  const atual = habilitadas.findIndex((opcao) => opcao.value === valor);
  let destino: number;
  switch (evento.key) {
    case "ArrowRight":
    case "ArrowDown":
      destino = (atual + 1) % habilitadas.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      destino = (atual - 1 + habilitadas.length) % habilitadas.length;
      break;
    case "Home":
      destino = 0;
      break;
    case "End":
      destino = habilitadas.length - 1;
      break;
    default:
      return;
  }
  evento.preventDefault();
  const proxima = habilitadas[destino].value;
  if (proxima !== valor) escolher(proxima);
  botoes(proxima)?.focus();
}
