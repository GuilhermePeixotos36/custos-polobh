import { useEffect } from "react";
import { useConfirm } from "@/store/confirm";
import { buttonVariants } from "@heroui/styles";

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
    /* z-90: acima dos modais (z-[70]) e do painel do Help Desk. Em z-60 a
       confirmação abria ATRÁS de quem a pediu — invisível e inclicável, então a
       promessa nunca resolvia e o botão ficava travado em "…". */
    <div className="no-print fixed inset-0 z-90 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-backdrop backdrop-blur-[2px]"
        onClick={() => responder(false)}
      />
      <div className="relative w-full max-w-[420px] bg-overlay rounded-3xl shadow-overlay p-6 animate-[fadein_.12s_ease]">
        <h3 className="font-display font-semibold text-[17px] text-foreground tracking-[-0.3px]">{opts.titulo}</h3>
        {/* `whitespace-pre-line`: a mensagem às vezes traz um parágrafo extra
            (ex.: os itens que ficaram de fora da emissão de OS). */}
        {opts.mensagem && <p className="text-ink-2 text-[13.5px] mt-2 leading-relaxed whitespace-pre-line">{opts.mensagem}</p>}

        <div className="flex justify-end gap-2 mt-6">
          {!opts.somenteOk && (
            <button
              onClick={() => responder(false)}
              className={buttonVariants({ variant: "tertiary" })}
            >
              {opts.cancelarTexto ?? "Cancelar"}
            </button>
          )}
          <button
            autoFocus
            onClick={() => responder(true)}
            className={buttonVariants({ variant: danger ? "danger" : "primary" })}
          >
            {opts.confirmarTexto ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
