/**
 * Botão com contador que abre um painel flutuante — o aviso que não empurra a página.
 *
 * A faixa de pendência no topo da tela cresce com o número de pendências: com oito contratos
 * vencendo, a lista que a pessoa veio ver começava abaixo da dobra. E o custo era pago por todo
 * mundo o tempo todo, inclusive por quem já tinha lido o aviso. Aqui o que fica na tela é um
 * controle de altura fixa; o conteúdo só existe enquanto alguém o pede.
 *
 * O painel sai por portal no `body` com `position: fixed`, pelo mesmo motivo do `ComboBox`: as
 * telas do app vivem dentro de contêineres com `overflow` (painel de aba, área rolável da lista),
 * e um painel no fluxo era cortado na borda deles. A camada é a mesma 10040 — acima de todos os
 * modais do app, que chegam a 10030.
 *
 * O contador NÃO esconde a gravidade: quem chama passa `tom="perigo"` quando há caso que não
 * pode esperar, e aí o próprio botão fica vermelho e escreve o recorte crítico ao lado do total.
 * O que o painel guarda é o detalhe — quem, em que data —, nunca a existência do problema.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFecharComEsc } from "@/lib/modalEsc";
import { usePresenca } from "@/lib/presenca";

/** Acima do modal mais alto do app (10030), como a lista do `ComboBox`. */
const CAMADA = 10040;
const LARGURA = 400;
const ALTURA_MAXIMA = 420;
const MARGEM = 8;

type Props = {
  /** O texto do botão — é por ele que a pessoa (e o leitor de tela) acha o controle. */
  rotulo: string;
  /** Quantos itens o painel guarda. Vai no selo do botão. */
  contador: number;
  /** Recorte que não pode ficar escondido: aparece no botão, fora do painel. */
  destaque?: string;
  tom?: "atencao" | "perigo";
  icone?: ReactNode;
  /** Cabeçalho do painel. Também é o nome acessível da região flutuante. */
  titulo: string;
  children: ReactNode;
};

export function PainelSuspenso({ rotulo, contador, destaque, tom = "atencao", icone, titulo, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const idPainel = `${useId()}-painel`;
  const { montado: painelMontado, saindo } = usePresenca(aberto);

  /**
   * Fechar devolve o foco ao botão.
   *
   * Sem isso, o ESC e o clique fora deixam o foco no `body`: quem navega por teclado cai no
   * começo da página e tem de percorrer o cabeçalho inteiro de volta até o controle que acabou
   * de usar. Como todas as saídas passam por aqui (ESC, clique fora, segundo clique no botão),
   * é um lugar só para a regra.
   */
  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }

  useFecharComEsc(fechar, aberto);

  // Posição calculada do botão, com o painel pendurado no `body`. Alinhado pela DIREITA: o botão
  // mora no canto direito do cabeçalho, e um painel largo aberto para a direita sairia da janela.
  useLayoutEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const area = botao.current?.getBoundingClientRect();
      if (!area) return;
      const largura = Math.min(LARGURA, window.innerWidth - MARGEM * 2);
      setPosicao({
        left: Math.min(Math.max(MARGEM, area.right - largura), Math.max(MARGEM, window.innerWidth - largura - MARGEM)),
        top: area.bottom + 6,
        maxHeight: Math.min(ALTURA_MAXIMA, Math.max(160, window.innerHeight - area.bottom - MARGEM * 3)),
      });
    }
    posicionar();
    // Em captura para pegar também a rolagem do contêiner interno, não só a da janela.
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);

  // `pointerdown` e não `click`: fecha antes que o alvo do clique se mova por causa do
  // fechamento. O próprio botão fica de fora — quem cuida dele é o `onClick`, que alterna.
  useEffect(() => {
    if (!aberto) return;
    function aoApontar(evento: PointerEvent) {
      const alvo = evento.target as Node;
      if (botao.current?.contains(alvo) || painel.current?.contains(alvo)) return;
      fechar();
    }
    document.addEventListener("pointerdown", aoApontar, true);
    return () => document.removeEventListener("pointerdown", aoApontar, true);
  }, [aberto]);

  const perigo = tom === "perigo";

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-expanded={aberto}
        aria-controls={idPainel}
        // "Atenção" no azul da marca, vermelho só no "perigo" — a mesma divisão do sino
        // (`PainelPendencias`). Âmbar em todo aviso de prazo ensinava a pessoa a ignorar a cor;
        // assim o vermelho continua sendo o único tom que diz "já passou".
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
          perigo
            ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
            : "border-brand/25 bg-brand-soft/60 text-brand-forte hover:bg-brand-soft",
        )}
      >
        {icone}
        <span>{rotulo}</span>
        <span
          // `key`: o número que muda troca subindo, e o olho percebe que a contagem não é a mesma.
          key={contador}
          className={cn(
            "contagem-troca inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-bold tabular-nums",
            // Sobre o laranja, texto escuro (contraste); sobre o vermelho, branco.
            perigo ? "bg-destructive text-white" : "bg-brand text-primary-foreground",
          )}
        >
          {contador}
        </span>
        {destaque ? <span className="text-xs font-semibold">· {destaque}</span> : null}
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      </button>

      {painelMontado && posicao
        ? createPortal(
            <section
              ref={painel}
              id={idPainel}
              aria-label={titulo}
              // Saindo, já fechou para teclado e leitor de tela; só o olho o vê subir.
              aria-hidden={saindo || undefined}
              inert={saindo ? "" : undefined}
              // `position` junto de `left`/`top` em vez de vir por classe: os quatro são a mesma
              // decisão — o painel é posicionado pela janela, e sai do fluxo por isso.
              style={{ position: "fixed", left: posicao.left, top: posicao.top, width: Math.min(LARGURA, window.innerWidth - MARGEM * 2), maxHeight: posicao.maxHeight, zIndex: CAMADA }}
              className={cn(saindo ? "saida-popover" : "entrada-popover", "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-(--sombra-flutuante)")}
            >
              {/* Título em caixa normal, como o do sino: frase em CAIXA ALTA espaçada se lê letra
                  a letra, e aqui o título é uma frase inteira ("Contratos de experiência que…"). */}
              <header className="shrink-0 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-navy">{titulo}</h2>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
