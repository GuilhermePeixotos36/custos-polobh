import { useEffect } from "react";
import { useConfirm } from "@/store/confirm";
import { cx } from "@/lib/format";

/** Modal de confirmação — montado uma vez no AppLayout. */
export function ConfirmDialog() {
  const { aberto, opts, responder } = useConfirm();

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") responder(false);
      if (e.key === "Enter") responder(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, responder]);

  if (!aberto || !opts) return null;

  const danger = opts.tom === "danger";

  return (
    /* z-[90]: acima dos modais (z-[70]) e do painel do Help Desk. Em z-[60] a
       confirmação abria ATRÁS de quem a pediu — invisível e inclicável, então a
       promessa nunca resolvia e o botão ficava travado em "…". */
    <div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => responder(false)}
      />
      <div className="relative w-full max-w-[420px] bg-surface rounded-card-lg shadow-modal border border-border p-6 animate-[fadein_.12s_ease]">
        <h3 className="font-display font-bold text-[17px] text-ink tracking-[-0.3px]">{opts.titulo}</h3>
        {/* `whitespace-pre-line`: a mensagem às vezes traz um parágrafo extra
            (ex.: os itens que ficaram de fora da emissão de OS). */}
        {opts.mensagem && <p className="text-ink-2 text-[13.5px] mt-2 leading-relaxed whitespace-pre-line">{opts.mensagem}</p>}

        <div className="flex justify-end gap-2 mt-6">
          {!opts.somenteOk && (
            <button
              onClick={() => responder(false)}
              className="h-10 px-4 rounded-btn font-bold text-sm bg-surface text-ink border-[1.5px] border-[#D6D9E0] hover:bg-[#FAFAFB]"
            >
              {opts.cancelarTexto ?? "Cancelar"}
            </button>
          )}
          <button
            autoFocus
            onClick={() => responder(true)}
            className={cx(
              "h-10 px-4 rounded-btn font-bold text-sm text-white transition-colors",
              danger ? "bg-danger hover:brightness-95" : "bg-primary-grad text-[#2A1602] shadow-btn"
            )}
          >
            {opts.confirmarTexto ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
