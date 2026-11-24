/**
 * Excluir em dois toques, no próprio botão — o substituto do `window.confirm` para exclusão de
 * linha.
 *
 * O primeiro toque na lixeira abre ao lado o "Excluir" vermelho e o "×"; só o segundo toque, no
 * vermelho, exclui. É o mesmo "tem certeza?" do diálogo do navegador sem a faixa cinza que trava
 * a aba, e sem tirar o olho da linha: a pessoa confirma olhando para o que vai apagar.
 *
 * Não serve para toda exclusão. O que leva junto outras coisas (a vaga e as candidaturas dela, a
 * pesquisa e as respostas) precisa DIZER o que vai junto, e isso não cabe num botão — lá vai o
 * `confirmar()` de `@/lib/avisos`, com o texto inteiro.
 *
 * ESC e clique fora desarmam. O ESC é tomado antes da pilha de modais (`modalEsc`): a lixeira
 * armada dentro de um modal desarma primeiro, e só o ESC seguinte fecha o modal.
 */
import { useEffect, useReducer, useRef } from "react";
import { Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { proximoEstadoExcluir } from "@/lib/botaoExcluir";

type Props = {
  /**
   * A exclusão. Pode ser assíncrona; o botão fica travado até ela terminar. Erro é com a tela: o
   * botão só volta ao início, quem mostra a mensagem é quem chamou.
   */
  onConfirmar: () => void | Promise<unknown>;
  /** O que será excluído, como o leitor de tela vai dizer: "Excluir comunicado Férias coletivas". */
  rotulo: string;
  /** O texto do botão vermelho. "Remover" quando a linha sai de um vínculo sem deixar de existir. */
  rotuloConfirmar?: string;
  desabilitado?: boolean;
  className?: string;
};

export function BotaoExcluir({ onConfirmar, rotulo, rotuloConfirmar = "Excluir", desabilitado, className }: Props) {
  const [estado, despachar] = useReducer(proximoEstadoExcluir, "ocioso");
  const caixa = useRef<HTMLSpanElement>(null);
  const lixeira = useRef<HTMLButtonElement>(null);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  const armado = estado !== "ocioso";

  useEffect(() => {
    if (estado !== "confirmando") return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      // Em captura na janela, antes do ouvinte da pilha de modais (no `document`), e marcado
      // como tratado: o ESC desarma a lixeira e para aqui.
      evento.preventDefault();
      evento.stopPropagation();
      despachar("cancelar");
      lixeira.current?.focus({ preventScroll: true });
    }
    function aoApontar(evento: PointerEvent) {
      if (!caixa.current?.contains(evento.target as Node)) despachar("cancelar");
    }
    window.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoApontar, true);
    return () => {
      window.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoApontar, true);
    };
  }, [estado]);

  async function confirmar() {
    despachar("confirmar");
    try {
      await onConfirmar();
    } catch {
      // A tela que chamou é quem avisa o erro; aqui o botão só destrava.
    } finally {
      // A linha excluída costuma desmontar antes de a promessa voltar.
      if (montado.current) despachar("terminar");
    }
  }

  function desistir() {
    despachar("cancelar");
    lixeira.current?.focus({ preventScroll: true });
  }

  return (
    <span ref={caixa} className={cn("inline-flex items-center", className)} data-confirmando={armado || undefined}>
      <button
        ref={lixeira}
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-expanded={armado}
        disabled={desabilitado || estado === "excluindo"}
        onClick={() => despachar("alternar")}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-input p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60",
          armado && "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <g className="excluir-tampa">
            <path d="M3 6h18" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </g>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>

      {/* Fechado, o painel é `inert`: largura zero não tira botão do Tab, e o "Excluir" não pode
          ser alcançado por teclado sem o primeiro toque. */}
      <span className="excluir-painel" data-aberto={armado || undefined} inert={!armado ? "" : undefined}>
        {/* Invólucro sem recuo: é ele que a coluna de 0fr espreme até zero. Com o `pl-1` direto
            no item da grade, o recuo sobrava como uma fresta de 4px com o painel fechado. */}
        <span>
          <span className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={estado !== "confirmando"}
              aria-label={`Confirmar: ${rotulo}`}
              className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-destructive px-2.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-70"
            >
              {estado === "excluindo" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {rotuloConfirmar}
            </button>
            <button
              type="button"
              onClick={desistir}
              disabled={estado !== "confirmando"}
              aria-label="Cancelar exclusão"
              title="Cancelar"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-navy disabled:opacity-70"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        </span>
      </span>

      <span className="sr-only" aria-live="polite">
        {estado === "confirmando" ? "Confirme a exclusão ou cancele." : estado === "excluindo" ? "Excluindo…" : ""}
      </span>
    </span>
  );
}
