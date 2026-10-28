import { createPortal } from "react-dom";

/**
 * AGUARDE NO MEIO DA TELA (28/10/2026): uma seta girando no centro, com o fundo
 * escurecido, enquanto o app salva ou revisa. Antes só o texto do botão mudava
 * ("Salvando…"), e quem não estava olhando para ele seguia clicando na tela.
 *
 * Fica ABAIXO dos diálogos (z-[85] < z-[90] do ConfirmDialog): a pergunta e o
 * aviso de falha da revisão aparecem por cima dela.
 */
export function CarregandoTela({ texto = "Salvando…" }: { texto?: string }) {
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed inset-0 z-[85] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
    >
      <div className="flex flex-col items-center gap-3 rounded-card-lg bg-surface px-8 py-6 shadow-modal border border-border">
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary motion-safe:animate-spin"
          aria-hidden="true"
        >
          {/* Seta circular: o arco e a ponta da seta. */}
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        <span className="font-display font-bold text-[14px] text-ink">{texto}</span>
      </div>
    </div>,
    document.body,
  );
}
