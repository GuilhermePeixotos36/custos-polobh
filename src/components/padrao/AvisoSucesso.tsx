/**
 * O aviso verde do canto — "Processamento concluído", "Sincronização concluída".
 *
 * Seis telas tinham a mesma pílula copiada à mão, cada uma sumindo seco quando o temporizador
 * dela zerava a mensagem. Aqui ela entra descendo 4px, o ✓ se desenha (o sinal de que a ação
 * terminou, e não só de que há uma mensagem) e, quando a tela zera o texto, sai pelo mesmo
 * caminho em 120ms mostrando ainda o texto que tinha.
 *
 * O tempo na tela continua com quem chama — cada seção já tinha o seu (3,5s, 5s) e o motivo
 * dele. O componente só dá entrada e saída a um texto que aparece e some.
 *
 * Portal no `body`: a seção que dispara o aviso pode estar dentro de painel com `overflow` ou de
 * bloco com animação de entrada, e `position: fixed` ali dentro deixaria de ser a janela.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePresenca } from "@/lib/presenca";

export function AvisoSucesso({ mensagem, onFechar }: {
  mensagem: string;
  /** Com ele aparece o "×": para o aviso longo, que a pessoa já leu antes de o tempo acabar. */
  onFechar?: () => void;
}) {
  const { montado, saindo } = usePresenca(Boolean(mensagem));
  const [ultima, setUltima] = useState(mensagem);
  // Estado derivado de prop: guarda o texto para a saída, quando a tela já o zerou.
  if (mensagem && mensagem !== ultima) setUltima(mensagem);

  if (!montado) return null;
  const texto = mensagem || ultima;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-hidden={saindo || undefined}
      className={cn(
        "fixed right-5 top-5 z-[100] flex max-w-[min(28rem,calc(100vw-2.5rem))] items-start gap-2 rounded-lg border border-success/30 bg-success px-3 py-2 text-xs font-semibold text-white shadow-(--sombra-flutuante)",
        saindo ? "saida-popover" : "entrada-popover",
      )}
    >
      {/* `key` no texto: mensagem nova com o aviso ainda aberto redesenha o ✓ — é outra ação
          que terminou. */}
      <svg key={texto} viewBox="0 0 24 24" className="mt-px h-4 w-4 shrink-0" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} opacity={0.45} />
        <path className="check-desenha" pathLength={1} d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{texto}</span>
      {onFechar && (
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar aviso"
          className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>,
    document.body,
  );
}
