/**
 * Coluna dos ITENS da OS nas listagens — o "olhinho" ao lado do número.
 *
 * A OS consolida vários itens da EC, e saber quais é justamente o que faltava
 * na lista: para descobrir era preciso abrir OS por OS. Escrever os nomes na
 * própria linha resolveria e criaria outro problema — uma OS com oito itens
 * esticaria a linha e desalinharia a tabela inteira.
 *
 * Então o conteúdo fica guardado atrás de um ícone, numa coluna estreita e SEM
 * cabeçalho (ela não é um dado da tabela, é um atalho). Passar o mouse já
 * mostra; clicar PRENDE a caixinha aberta, para dar tempo de ler uma lista
 * longa, mover o mouse até ela e usar no toque, onde não existe "passar o
 * mouse". Esc ou clique fora fecham.
 *
 * A caixinha é desenhada por cima de tudo (portal + posição fixa) porque a
 * tabela rola na horizontal: dentro da célula, ela seria cortada na borda.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Th, Td } from "@/components/ui";
import { IcList } from "@/components/icons";
import { cx } from "@/lib/format";
import type { ItemDaOs } from "@/domain/os";

/** Coluna estreita: cabe o ícone, sem roubar espaço do número da OS. */
const LARGURA = "w-[40px] min-w-[40px] px-1";

/** Largura da caixinha e folga que ela guarda das bordas da janela. */
const LARGURA_CAIXA = 260;
const MARGEM = 8;

/**
 * Cabeçalho vazio de propósito: a coluna é um atalho, não um dado — dar-lhe um
 * rótulo ("Itens") sugeriria que dá para ordenar por ele. O texto existe só
 * para o leitor de tela.
 */
export function ThItensOs({ className }: { className?: string }) {
  return (
    <Th align="center" className={cx(LARGURA, className)}>
      <span className="sr-only">Itens da OS</span>
    </Th>
  );
}

export function TdItensOs({ itens, className }: { itens: ItemDaOs[]; className?: string }) {
  return (
    <Td align="center" className={cx(LARGURA, className)}>
      {itens.length > 0 && <BotaoItens itens={itens} />}
    </Td>
  );
}

function BotaoItens({ itens }: { itens: ItemDaOs[] }) {
  const [aberto, setAberto] = useState(false);
  /** Preso pelo clique: só fecha por Esc, clique fora ou novo clique no ícone. */
  const [preso, setPreso] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  /**
   * Fechar tem carência: entre o ícone e a caixinha há uma folga de 6px, e sem
   * esse respiro a caixa fechava no meio do caminho do mouse até ela.
   */
  const relogio = useRef<number>(0);
  const manterAberto = () => {
    window.clearTimeout(relogio.current);
    setAberto(true);
  };
  const fecharComCarencia = () => {
    if (preso) return;
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => setAberto(false), 120);
  };
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  /** Ancora a caixinha no ícone, sem deixá-la sair da janela. */
  const posicionar = () => {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    setPosicao({
      top: Math.min(r.bottom + 6, window.innerHeight - MARGEM),
      left: Math.max(MARGEM, Math.min(r.left + r.width / 2 - LARGURA_CAIXA / 2, window.innerWidth - LARGURA_CAIXA - MARGEM)),
    });
  };

  useLayoutEffect(() => {
    if (aberto) posicionar();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => {
      window.clearTimeout(relogio.current);
      setAberto(false);
      setPreso(false);
    };
    const fora = (e: MouseEvent) => {
      if (!botao.current?.contains(e.target as Node) && !caixa.current?.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    // Rolar ou redimensionar move o ícone: a caixinha some em vez de flutuar solta.
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  const rotulo = `${itens.length} ${itens.length === 1 ? "item" : "itens"} nesta OS`;

  return (
    <>
      <button
        ref={botao}
        type="button"
        // A linha inteira navega para a OS: o atalho não pode arrastar junto.
        onClick={(e) => {
          e.stopPropagation();
          // Preso → solta e fecha. Caso contrário, prende aberto (é o caminho do
          // toque, onde não existe "passar o mouse").
          if (preso) {
            setPreso(false);
            setAberto(false);
            return;
          }
          setPreso(true);
          manterAberto();
        }}
        onMouseEnter={manterAberto}
        onMouseLeave={fecharComCarencia}
        onFocus={manterAberto}
        onBlur={fecharComCarencia}
        aria-label={rotulo}
        aria-expanded={aberto}
        title={rotulo}
        className={cx(
          "inline-flex h-7 w-7 items-center justify-center rounded-btn transition-colors",
          aberto ? "bg-primary-soft text-primary-dark" : "text-ink-3 hover:text-primary-dark hover:bg-[#F1F2F5]"
        )}
      >
        <IcList width={15} height={15} />
      </button>

      {aberto && posicao &&
        createPortal(
          <div
            ref={caixa}
            role="tooltip"
            style={{ position: "fixed", top: posicao.top, left: posicao.left, width: LARGURA_CAIXA, zIndex: 80 }}
            className="rounded-card border border-border bg-white shadow-modal overflow-hidden"
            onMouseEnter={manterAberto}
            onMouseLeave={fecharComCarencia}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-border-soft text-[11px] font-extrabold uppercase tracking-wider text-ink-3">
              {rotulo}
            </div>
            {/* Lista longa rola dentro da caixinha — a linha da tabela nunca cresce. */}
            <ul className="max-h-[min(18rem,50vh)] overflow-y-auto py-1.5">
              {itens.map((i) => (
                <li key={i.id} className="px-3 py-1 flex gap-2">
                  <span aria-hidden="true" className="text-primary shrink-0">•</span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink leading-snug">{i.item}</span>
                    {i.grupo && <span className="block text-[11px] text-ink-3 leading-snug">{i.grupo}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
