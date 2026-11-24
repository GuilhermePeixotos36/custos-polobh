/**
 * O botão de gravar: "Salvar" → spinner + "Salvando…" → ✓ "Salvo" → "Salvar" de novo.
 *
 * Cada formulário fazia o seu `setSalvando(true)` com texto condicional, e o rótulo trocava
 * seco — o botão encolhia de "Salvar alterações" para "Salvando…" e a pessoa perdia o alvo do
 * clique. Aqui os três rótulos ficam empilhados na mesma célula de grade: o botão tem sempre a
 * largura do maior e a troca é só fade + 3px (sai subindo em 120ms e só então o novo entra,
 * subindo em 160ms). Em folha, nunca no botão: transform aqui não prende modal nenhum.
 *
 * Dois jeitos de usar:
 * - `onClick` que devolve Promise: o botão cuida do estado sozinho. Processa enquanto ela corre e,
 *   se ainda estiver na tela quando resolver, mostra o ✓ por 1,2s e volta. Resolver com `false`
 *   quer dizer "não gravou" — é como as telas que engolem o erro no `alertaDeErro` avisam o botão
 *   para voltar ao rótulo na hora, sem ✓ mentindo sobre uma gravação que não houve. Rejeição
 *   também volta direto e é engolida: mostrar o erro é de quem chama, não do botão.
 * - `processando` controlado: para o `type="submit"` (a Promise mora no `onSubmit` do form) e para
 *   o modal que já tem o próprio estado de gravação. Não há ✓: quem controla sabe se gravou, o
 *   botão não.
 *
 * O ✓ é o mesmo traço que se desenha do `AvisoSucesso`. No modal que fecha ao salvar ele nem
 * chega a aparecer — o fechamento já é o retorno.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/padrao/button";

/** Quanto tempo o ✓ fica antes de o botão voltar ao rótulo. */
export const DURACAO_CONCLUIDO_MS = 1200;

type Estado = "ocioso" | "processando" | "concluido";

export type RotulosBotaoAcao = {
  ocioso: React.ReactNode;
  processando: string;
  concluido: string;
};

const ROTULOS_PADRAO: RotulosBotaoAcao = { ocioso: "Salvar", processando: "Salvando…", concluido: "Salvo" };

export interface BotaoAcaoProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Devolvendo Promise, o botão controla o próprio estado. `false` resolvido = não gravou. */
  onClick?: (evento: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** Estado controlado de fora — sem ✓ (veja o comentário do arquivo). */
  processando?: boolean;
  rotulos?: Partial<RotulosBotaoAcao>;
  /** O rótulo de repouso, com ícone se houver. Vence `rotulos.ocioso`. */
  children?: React.ReactNode;
}

function ehPromessa(valor: unknown): valor is PromiseLike<unknown> {
  return typeof (valor as PromiseLike<unknown> | null)?.then === "function";
}

export const BotaoAcao = React.forwardRef<HTMLButtonElement, BotaoAcaoProps>(function BotaoAcao(
  { onClick, processando, rotulos, children, className, disabled, type = "button", ...props },
  ref,
) {
  const [interno, setInterno] = React.useState<Estado>("ocioso");
  // O duplo clique chega antes do novo render: é a ref, e não o `disabled`, que barra o segundo.
  const ocupado = React.useRef(false);
  const montado = React.useRef(true);
  const temporizador = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      window.clearTimeout(temporizador.current);
    };
  }, []);

  const estado: Estado = processando ? "processando" : interno;
  // A primeira pintura não anima: o rótulo de repouso entra com o formulário, não depois dele.
  const [animar, setAnimar] = React.useState(false);
  if (estado !== "ocioso" && !animar) setAnimar(true);

  const texto = { ...ROTULOS_PADRAO, ...rotulos, ...(children !== undefined ? { ocioso: children } : {}) };

  function aoClicar(evento: React.MouseEvent<HTMLButtonElement>) {
    if (ocupado.current || processando) return;
    const retorno = onClick?.(evento);
    if (!ehPromessa(retorno)) return;
    ocupado.current = true;
    window.clearTimeout(temporizador.current);
    setInterno("processando");
    const terminar = (gravou: boolean) => {
      ocupado.current = false;
      // Modal que fechou ao salvar: o botão já saiu da tela e não há estado a atualizar.
      if (!montado.current) return;
      if (!gravou) { setInterno("ocioso"); return; }
      setInterno("concluido");
      temporizador.current = window.setTimeout(() => {
        if (montado.current) setInterno("ocioso");
      }, DURACAO_CONCLUIDO_MS);
    };
    retorno.then((valor) => terminar(valor !== false), () => terminar(false));
  }

  const camada = (qual: Estado) => ({
    "data-ativo": estado === qual || undefined,
    // Só o rótulo da vez conta para o nome acessível; os outros estão ali para reservar largura.
    "aria-hidden": estado !== qual || undefined,
  });

  return (
    <>
      <button
        ref={ref}
        type={type}
        {...props}
        onClick={aoClicar}
        disabled={disabled || estado === "processando"}
        aria-busy={estado === "processando" || undefined}
        className={cn(className ?? buttonVariants(), estado === "processando" && "cursor-wait")}
      >
        <span className="botao-acao-rotulos" data-animar={animar || undefined}>
          <span {...camada("ocioso")}>{texto.ocioso}</span>
          <span {...camada("processando")}>
            <Loader2 className={cn("h-4 w-4 shrink-0", estado === "processando" && "animate-spin")} aria-hidden />
            {texto.processando}
          </span>
          <span {...camada("concluido")}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
              {/* Monta só no ✓: é a montagem que dispara o traço, e cada gravação o redesenha. */}
              {estado === "concluido" && (
                <path className="check-desenha" pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {texto.concluido}
          </span>
        </span>
      </button>
      {/* Fora do botão: dentro, o anúncio entraria no nome acessível dele.
          `left-0 top-0` prende o anúncio no canto do bloco que o contém. Sem eles, o `sr-only`
          (absoluto) ficava na posição estática — ao lado do botão, na coluna 30 da tabela do VT —
          e, como o bloco de referência fica FORA da rolagem da tabela, esticava a página para
          2.651px (Vale-Transporte e Combustível, out/2026). Embrulhar em `relative inline-flex`
          também resolveria, mas mudaria o layout de quem usa `ml-auto`/`mr-auto` no botão. */}
      <span role="status" aria-live="polite" className="sr-only left-0 top-0">
        {estado === "processando" ? texto.processando : estado === "concluido" ? texto.concluido : ""}
      </span>
    </>
  );
});
