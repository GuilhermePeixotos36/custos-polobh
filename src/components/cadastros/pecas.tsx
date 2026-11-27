/**
 * As peças comuns das janelas de cadastro (fornecedores e clientes): a janela,
 * o título de bloco e o erro de campo. As duas fichas e os dois formulários são
 * montados com elas, para os cadastros terem uma cara só.
 */
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { IcFechar } from "@/components/icons";

export function Janela({ titulo, subtitulo, onClose, children, rodape }: {
  titulo: string; subtitulo?: ReactNode; onClose: () => void; children: ReactNode; rodape?: ReactNode;
}) {
  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-label={titulo} className="relative flex w-full max-w-[820px] max-h-[92vh] flex-col bg-surface rounded-card-lg shadow-modal border border-border">
        <div className="px-6 pt-5 pb-4 border-b border-border-soft">
          <button type="button" onClick={onClose} title="Fechar" className="absolute right-3 top-3 rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5]">
            <IcFechar width={18} height={18} />
          </button>
          <h2 className="font-display text-lg font-bold pr-8">{titulo}</h2>
          {subtitulo && <div className="text-[13px] text-ink-2 mt-0.5">{subtitulo}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {rodape && <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-soft">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Título de um bloco do formulário ou da ficha. */
export const Bloco = ({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) => (
  <section>
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{titulo}</h3>
      {acao}
    </div>
    {children}
  </section>
);

export const ErroCampo = ({ texto }: { texto?: string }) => (texto ? <p className="mt-1 text-[12px] font-semibold text-danger" role="alert">{texto}</p> : null);
