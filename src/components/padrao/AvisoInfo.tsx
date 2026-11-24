import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info } from "lucide-react";
import { usePresenca } from "@/lib/presenca";

type AvisoProps = {
  children: ReactNode;
  /** Chamado quando o balão aparece — usado para apontar o caminho no menu. */
  aoAbrir?: () => void;
  rotulo: string;
  /** Atalho para resolver a pendência sem sair da tela. */
  acao?: { rotulo: string; aoClicar: () => void };
};

const LARGURA = 360;
const MARGEM = 8;
/** Abaixo do modal (9990) e acima de tudo mais: o balão informa, o modal age. */
const CAMADA = 9980;

/**
 * Balão de aviso, aberto por um gatilho.
 *
 * Superfície branca de popover com o azul da marca, e não mais o âmbar translúcido com vidro
 * fosco: o que ele guarda é pendência de cadastro ("3 sem cartão de ponto"), atenção e não
 * erro — a mesma faixa que o sino pinta de azul. O texto em âmbar sobre âmbar a 10% também
 * ficava abaixo do contraste de leitura, justamente num balão feito para ser lido.
 *
 * Vai para um portal no fim do documento, e não ao lado do gatilho, porque as seções de
 * benefício são `overflow-hidden` e as tabelas rolam dentro de si: pendurado no fluxo, o balão
 * era cortado na borda do cartão e sumia atrás da tabela. Em posição fixa, calculada a partir
 * do gatilho, ele escapa de todo recorte — e ainda cabe na janela, porque o cálculo prende as
 * bordas dentro dela.
 *
 * O fechamento é adiado por um instante: o balão fica fora do invólucro do gatilho, então sair
 * de um para entrar no outro passa por um vão de alguns pixels que fecharia tudo no meio do
 * movimento de ir clicar no atalho.
 */
function Balao({ children, aoAbrir, rotulo, acao, gatilho }: AvisoProps & {
  gatilho: (props: { aberto: boolean; alternar: () => void }) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState({ left: 0, top: 0 });
  const ancora = useRef<HTMLSpanElement>(null);
  const saida = useRef<number | null>(null);
  const abertoAntes = useRef(false);
  // Voltar o cursor ao balão no meio da saída cancela a saída: `usePresenca` devolve `saindo`
  // a falso e o balão fica, sem piscar.
  const { montado, saindo } = usePresenca(aberto);

  useEffect(() => {
    if (aberto && !abertoAntes.current) aoAbrir?.();
    abertoAntes.current = aberto;
  }, [aberto, aoAbrir]);

  useEffect(() => () => { if (saida.current !== null) window.clearTimeout(saida.current); }, []);

  useLayoutEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const area = ancora.current?.getBoundingClientRect();
      if (!area) return;
      const centralizado = area.left + area.width / 2 - LARGURA / 2;
      setPosicao({
        left: Math.min(Math.max(MARGEM, centralizado), window.innerWidth - LARGURA - MARGEM),
        top: area.bottom + 6,
      });
    }
    posicionar();
    // `true` para pegar a rolagem de qualquer contêiner no caminho, não só a da janela.
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);

  function manter() {
    if (saida.current !== null) window.clearTimeout(saida.current);
    saida.current = null;
    setAberto(true);
  }

  function agendarFechamento() {
    if (saida.current !== null) window.clearTimeout(saida.current);
    saida.current = window.setTimeout(() => setAberto(false), 140);
  }

  return (
    <>
      <span ref={ancora} className="inline-flex" onMouseEnter={manter} onMouseLeave={agendarFechamento}>
        {gatilho({ aberto, alternar: () => (aberto ? setAberto(false) : manter()) })}
      </span>

      {montado ? createPortal(
        <div
          role="status"
          aria-label={rotulo}
          aria-hidden={saindo || undefined}
          onMouseEnter={manter}
          onMouseLeave={agendarFechamento}
          style={{ left: posicao.left, top: posicao.top, width: LARGURA, zIndex: CAMADA }}
          className={`${saindo ? "saida-popover" : "entrada-popover"} fixed rounded-lg border border-border bg-card p-3 text-xs text-foreground shadow-(--sombra-flutuante)`}
        >
          <p className="mb-1.5 text-xs font-semibold text-navy">{rotulo}</p>
          <div className="max-h-56 overflow-auto whitespace-normal leading-relaxed text-muted-foreground">{children}</div>
          {acao ? (
            <button
              type="button"
              onClick={acao.aoClicar}
              className="mt-2.5 inline-flex h-7 items-center rounded-md bg-brand px-2.5 text-2xs font-semibold text-primary-foreground hover:bg-brand-vivid shadow-(--sombra-botao)"
            >
              {acao.rotulo}
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

/** Selo redondo com "i" — para o aviso que acompanha um título. */
export function AvisoInfo(props: AvisoProps) {
  return (
    <Balao
      {...props}
      gatilho={({ aberto, alternar }) => (
        <button
          type="button"
          aria-label={props.rotulo}
          aria-expanded={aberto}
          onClick={alternar}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-brand-forte ring-1 ring-brand/25 transition-colors hover:bg-brand/15"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}
    />
  );
}

/**
 * Pílula com a contagem — para a faixa de pendências.
 *
 * A lista inteira de nomes na faixa ocupava três linhas e empurrava a tabela para baixo, sem
 * que ninguém precisasse dos nomes o tempo todo. Na pílula fica o que interessa de relance —
 * quantos e de quê —, e a lista aparece só para quem for tratar a pendência.
 */
export function AvisoPill({ contagem, rotulo, ...props }: AvisoProps & { contagem: number }) {
  return (
    <Balao
      {...props}
      rotulo={rotulo}
      gatilho={({ aberto, alternar }) => (
        <button
          type="button"
          aria-expanded={aberto}
          onClick={alternar}
          className="inline-flex h-6 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 text-2xs font-semibold text-brand-forte transition-colors hover:bg-brand/15"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">{contagem}</span>
          {rotulo}
        </button>
      )}
    />
  );
}
